// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Admin environment lifecycle + membership callables
// create / update / delete environment, add-user / remove-user / list-users.
//
// Key model: the environment DEK is generated and wrapped entirely client-side
// by the admin CLI. The server only stores per-user wrapped copies. On revoke,
// deleting the wrap removes the user's ability to decrypt; the admin then
// rotates the DEK (re-encrypt + re-wrap) so cached copies become worthless.
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, db } from './config';
import {
  requireActiveUser,
  requireOrgAdmin,
  resolveEnvironment,
} from './middleware/auth';
import { requireString, optionalString, validateEncryptedVariables } from './middleware/validation';
import { writeAudit } from './middleware/audit';
import type { EnvironmentMemberDoc, EnvironmentKeyDoc } from './types';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * createEnvironment — admin creates a new environment. The admin's CLI has
 * already generated a DEK and wrapped it for themselves (adminWrappedDEK).
 */
export const createEnvironment = onCall({ region: REGION }, async (request) => {
  const { uid, email } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  const projectId = requireString(request.data?.projectId, 'projectId');
  await requireOrgAdmin(uid, organizationId);

  const name = requireString(request.data?.name, 'name');
  const slug = requireString(request.data?.slug, 'slug').toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new HttpsError('invalid-argument', 'slug must be lowercase alphanumeric with dashes.');
  }
  const type = optionalString(request.data?.type, 'type') ?? 'custom';
  const adminWrappedDEK = requireString(request.data?.adminWrappedDEK, 'adminWrappedDEK');

  const projectSnap = await db.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists || projectSnap.data()?.organizationId !== organizationId) {
    throw new HttpsError('not-found', 'Project not found in this organization.');
  }

  const environmentId = `${projectId}_${slug}`;
  const envRef = db.doc(`environments/${environmentId}`);
  if ((await envRef.get()).exists) {
    throw new HttpsError('already-exists', `Environment "${slug}" already exists.`);
  }

  const now = Date.now();
  const batch = db.batch();

  batch.set(envRef, {
    id: environmentId,
    projectId,
    organizationId,
    name,
    slug,
    type,
    color: optionalString(request.data?.color, 'color') ?? '#6366f1',
    description: optionalString(request.data?.description, 'description') ?? '',
    order: typeof request.data?.order === 'number' ? request.data.order : 0,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  });

  const keyDoc: EnvironmentKeyDoc = {
    environmentId,
    organizationId,
    keyVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  batch.set(db.doc(`environmentKeys/${environmentId}`), keyDoc);

  const memberDoc: EnvironmentMemberDoc = {
    id: `${environmentId}_${uid}`,
    environmentId,
    projectId,
    organizationId,
    userId: uid,
    email,
    wrappedDEK: adminWrappedDEK,
    keyVersion: 1,
    status: 'active',
    lastSyncAt: null,
    lastSyncChecksum: null,
    grantedBy: uid,
    grantedAt: now,
  };
  batch.set(db.doc(`environmentMembers/${environmentId}_${uid}`), memberDoc);

  await batch.commit();
  await writeAudit(
    { organizationId, projectId, environmentId, action: 'environment.created', actorId: uid, actorEmail: email, details: { slug, type } },
    request,
  );

  return { ok: true, environmentId, keyVersion: 1 };
});

/** updateEnvironment — admin updates mutable metadata. */
export const updateEnvironment = onCall({ region: REGION }, async (request) => {
  const { uid, email } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  await requireOrgAdmin(uid, organizationId);

  const envSnap = await resolveEnvironment(organizationId, {
    environmentId: optionalString(request.data?.environmentId, 'environmentId'),
    environmentSlug: optionalString(request.data?.environmentSlug, 'environmentSlug'),
    projectId: optionalString(request.data?.projectId, 'projectId'),
  });

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  const name = optionalString(request.data?.name, 'name');
  const description = optionalString(request.data?.description, 'description');
  const color = optionalString(request.data?.color, 'color');
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (color !== undefined) patch.color = color;
  if (typeof request.data?.order === 'number') patch.order = request.data.order;

  await envSnap.ref.update(patch);
  await writeAudit(
    { organizationId, projectId: envSnap.data()!.projectId, environmentId: envSnap.id, action: 'environment.updated', actorId: uid, actorEmail: email, details: { fields: Object.keys(patch) } },
    request,
  );
  return { ok: true };
});

/**
 * deleteEnvironment — admin permanently deletes an environment and everything
 * scoped to it: the environment document, every variable, every variable
 * version, the key-version record, and all membership grants (including wrapped
 * DEKs). This is a hard delete — nothing is recoverable afterwards.
 */
export const deleteEnvironment = onCall({ region: REGION }, async (request) => {
  const { uid, email } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  await requireOrgAdmin(uid, organizationId);

  const envSnap = await resolveEnvironment(organizationId, {
    environmentId: optionalString(request.data?.environmentId, 'environmentId'),
    environmentSlug: optionalString(request.data?.environmentSlug, 'environmentSlug'),
    projectId: optionalString(request.data?.projectId, 'projectId'),
  });
  const environmentId = envSnap.id;
  const projectId = envSnap.data()!.projectId;

  const [members, vars, versions] = await Promise.all([
    db.collection('environmentMembers').where('environmentId', '==', environmentId).get(),
    db.collection('variables').where('environmentId', '==', environmentId).get(),
    db.collection('versions').where('environmentId', '==', environmentId).get(),
  ]);

  // Firestore batches cap at 500 writes; chunk deletes to stay under the limit.
  const refs: FirebaseFirestore.DocumentReference[] = [
    ...members.docs.map((d) => d.ref),
    ...vars.docs.map((d) => d.ref),
    ...versions.docs.map((d) => d.ref),
    db.doc(`environmentKeys/${environmentId}`),
    envSnap.ref,
  ];

  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + CHUNK)) batch.delete(ref);
    await batch.commit();
  }

  await writeAudit(
    {
      organizationId,
      projectId,
      environmentId,
      action: 'environment.deleted',
      actorId: uid,
      actorEmail: email,
      details: {
        deletedVariables: vars.size,
        deletedVersions: versions.size,
        revokedMembers: members.size,
      },
    },
    request,
  );
  return { ok: true, deletedVariables: vars.size, deletedVersions: versions.size };
});

/**
 * addUserToEnvironment — admin grants a user access. The admin CLI has already
 * fetched the target's public key (getUserPublicKey) and wrapped the current
 * DEK for them (userWrappedDEK). Server just records the grant.
 */
export const addUserToEnvironment = onCall({ region: REGION }, async (request) => {
  const { uid, email } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  await requireOrgAdmin(uid, organizationId);

  const envSnap = await resolveEnvironment(organizationId, {
    environmentId: optionalString(request.data?.environmentId, 'environmentId'),
    environmentSlug: optionalString(request.data?.environmentSlug, 'environmentSlug'),
    projectId: optionalString(request.data?.projectId, 'projectId'),
  });
  const environmentId = envSnap.id;
  const projectId = envSnap.data()!.projectId;
  const targetUserId = requireString(request.data?.targetUserId, 'targetUserId');
  const targetEmail = requireString(request.data?.targetEmail, 'targetEmail').toLowerCase();
  const userWrappedDEK = requireString(request.data?.userWrappedDEK, 'userWrappedDEK');

  // The wrap must match the current environment key version.
  const keySnap = await db.doc(`environmentKeys/${environmentId}`).get();
  if (!keySnap.exists) {
    throw new HttpsError('failed-precondition', 'Environment has no key record.');
  }
  const keyVersion = (keySnap.data() as EnvironmentKeyDoc).keyVersion;

  // Verify target is an org member.
  const targetMember = await db.doc(`organizationMembers/${organizationId}_${targetUserId}`).get();
  if (!targetMember.exists) {
    throw new HttpsError('failed-precondition', `${targetEmail} is not a member of this organization.`);
  }

  const now = Date.now();
  const memberDoc: EnvironmentMemberDoc = {
    id: `${environmentId}_${targetUserId}`,
    environmentId,
    projectId,
    organizationId,
    userId: targetUserId,
    email: targetEmail,
    wrappedDEK: userWrappedDEK,
    keyVersion,
    status: 'active',
    lastSyncAt: null,
    lastSyncChecksum: null,
    grantedBy: uid,
    grantedAt: now,
  };
  await db.doc(`environmentMembers/${environmentId}_${targetUserId}`).set(memberDoc);

  await writeAudit(
    { organizationId, projectId, environmentId, action: 'member.joined', actorId: uid, actorEmail: email, details: { targetEmail, keyVersion } },
    request,
  );
  return { ok: true, keyVersion };
});

/**
 * removeUserFromEnvironment — admin revokes a user. Deletes their wrappedDEK
 * and marks them removed instantly. If the admin supplied a rotation payload
 * (new DEK re-wrapped for all remaining members + re-encrypted variables), the
 * DEK is rotated in the same transaction so any cached copy the removed user
 * kept is now worthless.
 */
export const removeUserFromEnvironment = onCall({ region: REGION }, async (request) => {
  const { uid, email } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  await requireOrgAdmin(uid, organizationId);

  const envSnap = await resolveEnvironment(organizationId, {
    environmentId: optionalString(request.data?.environmentId, 'environmentId'),
    environmentSlug: optionalString(request.data?.environmentSlug, 'environmentSlug'),
    projectId: optionalString(request.data?.projectId, 'projectId'),
  });
  const environmentId = envSnap.id;
  const projectId = envSnap.data()!.projectId;
  const targetEmail = requireString(request.data?.targetEmail, 'targetEmail').toLowerCase();

  const targetQuery = await db
    .collection('environmentMembers')
    .where('environmentId', '==', environmentId)
    .where('email', '==', targetEmail)
    .limit(1)
    .get();
  if (targetQuery.empty) {
    throw new HttpsError('not-found', `${targetEmail} is not a member of this environment.`);
  }
  const targetRef = targetQuery.docs[0].ref;
  const now = Date.now();

  // Optional rotation payload from the admin CLI.
  const rotation = request.data?.rotation as
    | { newWraps?: { userId: string; wrappedDEK: string }[]; variables?: unknown }
    | undefined;

  const batch = db.batch();
  batch.update(targetRef, {
    status: 'removed',
    wrappedDEK: null,
    revokedBy: uid,
    revokedAt: now,
  });

  let newKeyVersion: number | undefined;
  if (rotation?.newWraps && rotation.variables) {
    const variables = validateEncryptedVariables(rotation.variables);
    const keyRef = db.doc(`environmentKeys/${environmentId}`);
    const keySnap = await keyRef.get();
    newKeyVersion = ((keySnap.data() as EnvironmentKeyDoc)?.keyVersion ?? 1) + 1;
    batch.update(keyRef, { keyVersion: newKeyVersion, updatedAt: now });

    // Re-wrap for each remaining member.
    for (const wrap of rotation.newWraps) {
      const memberRef = db.doc(`environmentMembers/${environmentId}_${wrap.userId}`);
      batch.update(memberRef, { wrappedDEK: wrap.wrappedDEK, keyVersion: newKeyVersion, lastSyncAt: null });
    }

    // Re-encrypt every variable under the new DEK.
    const existing = await db.collection('variables').where('environmentId', '==', environmentId).get();
    const byKey = new Map(existing.docs.map((d) => [d.data().key as string, d]));
    for (const v of variables) {
      const doc = byKey.get(v.key);
      if (!doc) continue;
      batch.update(doc.ref, {
        encryptedValue: v.encryptedValue,
        iv: v.iv,
        fingerprint: v.fingerprint,
        version: (doc.data().version ?? 1) + 1,
        updatedBy: uid,
        updatedAt: now,
      });
    }
  }

  await batch.commit();
  await writeAudit(
    { organizationId, projectId, environmentId, action: 'member.removed', actorId: uid, actorEmail: email, details: { targetEmail, rotated: Boolean(newKeyVersion), newKeyVersion } },
    request,
  );
  return { ok: true, rotated: Boolean(newKeyVersion), keyVersion: newKeyVersion };
});

/** listEnvironmentUsers — admin lists all members of an environment. */
export const listEnvironmentUsers = onCall({ region: REGION }, async (request) => {
  const { uid } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  await requireOrgAdmin(uid, organizationId);

  const envSnap = await resolveEnvironment(organizationId, {
    environmentId: optionalString(request.data?.environmentId, 'environmentId'),
    environmentSlug: optionalString(request.data?.environmentSlug, 'environmentSlug'),
    projectId: optionalString(request.data?.projectId, 'projectId'),
  });

  const members = await db
    .collection('environmentMembers')
    .where('environmentId', '==', envSnap.id)
    .get();

  return {
    users: members.docs
      .map((d) => d.data() as EnvironmentMemberDoc)
      .filter((m) => m.status !== 'removed')
      .map((m) => ({
        email: m.email,
        userId: m.userId,
        status: m.status,
        keyVersion: m.keyVersion,
        lastSyncAt: m.lastSyncAt,
        grantedAt: m.grantedAt,
      })),
  };
});

/**
 * getEnvironmentRotationContext — admin helper. Returns the public keys of all
 * remaining active members plus the current encrypted variables, so the admin
 * CLI can perform a DEK rotation locally and submit the result to
 * removeUserFromEnvironment.
 */
export const getEnvironmentRotationContext = onCall({ region: REGION }, async (request) => {
  const { uid } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  await requireOrgAdmin(uid, organizationId);

  const envSnap = await resolveEnvironment(organizationId, {
    environmentId: optionalString(request.data?.environmentId, 'environmentId'),
    environmentSlug: optionalString(request.data?.environmentSlug, 'environmentSlug'),
    projectId: optionalString(request.data?.projectId, 'projectId'),
  });
  const environmentId = envSnap.id;
  const excludeEmail = optionalString(request.data?.excludeEmail, 'excludeEmail')?.toLowerCase();

  const members = await db
    .collection('environmentMembers')
    .where('environmentId', '==', environmentId)
    .get();

  const remaining = members.docs
    .map((d) => d.data() as EnvironmentMemberDoc)
    .filter((m) => m.status === 'active' && m.email !== excludeEmail);

  const publicKeys = await Promise.all(
    remaining.map(async (m) => {
      const keySnap = await db.doc(`userKeys/${m.userId}`).get();
      return { userId: m.userId, email: m.email, publicKeyJwk: keySnap.data()?.publicKeyJwk ?? null };
    }),
  );

  const varsSnap = await db.collection('variables').where('environmentId', '==', environmentId).get();
  const variables = varsSnap.docs
    .map((d) => d.data())
    .filter((v) => v.isDeleted !== true)
    .map((v) => ({ key: v.key, encryptedValue: v.encryptedValue, iv: v.iv, fingerprint: v.fingerprint }));

  return { environmentId, members: publicKeys.filter((k) => k.publicKeyJwk), variables };
});
