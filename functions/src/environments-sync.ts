// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Environment sync callables (CLI fetch/push/list)
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, db, SYNC_TTL_MS } from './config';
import {
  requireActiveUser,
  requireOrgMembership,
  requireOrgAdmin,
  resolveEnvironment,
} from './middleware/auth';
import { requireString, optionalString, validateEncryptedVariables } from './middleware/validation';
import { writeAudit } from './middleware/audit';
import type { EnvironmentMemberDoc } from './types';

/**
 * listEnvironments — every environment the caller can access across an org,
 * annotated with the caller's per-environment membership status + last sync.
 */
export const listEnvironments = onCall({ region: REGION }, async (request) => {
  const { uid } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  await requireOrgMembership(uid, organizationId);

  const memberships = await db
    .collection('environmentMembers')
    .where('organizationId', '==', organizationId)
    .where('userId', '==', uid)
    .get();

  const rows = await Promise.all(
    memberships.docs
      .map((d) => d.data() as EnvironmentMemberDoc)
      .filter((m) => m.status !== 'removed')
      .map(async (m) => {
        const envSnap = await db.doc(`environments/${m.environmentId}`).get();
        const env = envSnap.data();
        return {
          environmentId: m.environmentId,
          projectId: m.projectId,
          name: env?.name ?? '(deleted)',
          slug: env?.slug ?? '',
          type: env?.type ?? 'custom',
          status: m.status,
          keyVersion: m.keyVersion,
          lastSyncAt: m.lastSyncAt,
        };
      }),
  );
  return { environments: rows };
});

/**
 * fetchEnvironment — the CLI's read path. Validates the caller is an active
 * member of the environment, returns the encrypted variables plus the caller's
 * wrapped DEK, and stamps lastSyncAt. Inactive/removed members are rejected.
 */
export const fetchEnvironment = onCall({ region: REGION }, async (request) => {
  const { uid, email } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  await requireOrgMembership(uid, organizationId);

  const envSnap = await resolveEnvironment(organizationId, {
    environmentId: optionalString(request.data?.environmentId, 'environmentId'),
    environmentSlug: optionalString(request.data?.environmentSlug, 'environmentSlug'),
    projectId: optionalString(request.data?.projectId, 'projectId'),
  });
  const environmentId = envSnap.id;
  const env = envSnap.data()!;

  const memberRef = db.doc(`environmentMembers/${environmentId}_${uid}`);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'You do not have access to this environment.');
  }
  const member = memberSnap.data() as EnvironmentMemberDoc;
  if (member.status !== 'active') {
    throw new HttpsError(
      'permission-denied',
      `Access to "${env.slug}" has been revoked. Contact your admin.`,
    );
  }
  if (!member.wrappedDEK) {
    throw new HttpsError(
      'failed-precondition',
      'No key grant found. Ask an admin to re-add you to this environment.',
    );
  }

  const varsSnap = await db
    .collection('variables')
    .where('environmentId', '==', environmentId)
    .get();

  const variables = varsSnap.docs
    .map((d) => d.data())
    .filter((v) => v.isDeleted !== true)
    .map((v) => ({
      key: v.key,
      encryptedValue: v.encryptedValue,
      iv: v.iv,
      fingerprint: v.fingerprint,
      secretType: v.secretType ?? 'generic',
      visibility: v.visibility ?? 'secret',
      description: v.description ?? '',
    }));

  const syncAt = Date.now();
  await memberRef.update({ lastSyncAt: syncAt });
  await writeAudit(
    {
      organizationId,
      projectId: member.projectId,
      environmentId,
      action: 'environment.synced',
      actorId: uid,
      actorEmail: email,
      details: { direction: 'fetch', variableCount: variables.length, keyVersion: member.keyVersion },
    },
    request,
  );

  return {
    environmentId,
    slug: env.slug,
    name: env.name,
    keyVersion: member.keyVersion,
    wrappedDEK: member.wrappedDEK,
    variables,
    syncedAt: syncAt,
    expiresAt: syncAt + SYNC_TTL_MS,
  };
});

/**
 * pushEnvironment — admin write path. Accepts encrypted variables (never
 * plaintext) and replaces the environment's variable set transactionally.
 * Bumps every active member's need to re-fetch by writing a fresh checksum.
 */
export const pushEnvironment = onCall({ region: REGION }, async (request) => {
  const { uid, email } = await requireActiveUser(request);
  const organizationId = requireString(request.data?.organizationId, 'organizationId');
  await requireOrgAdmin(uid, organizationId);

  const envSnap = await resolveEnvironment(organizationId, {
    environmentId: optionalString(request.data?.environmentId, 'environmentId'),
    environmentSlug: optionalString(request.data?.environmentSlug, 'environmentSlug'),
    projectId: optionalString(request.data?.projectId, 'projectId'),
  });
  const environmentId = envSnap.id;
  const env = envSnap.data()!;
  const projectId = env.projectId;
  const variables = validateEncryptedVariables(request.data?.variables);
  const checksum = optionalString(request.data?.checksum, 'checksum') ?? null;

  const existing = await db
    .collection('variables')
    .where('environmentId', '==', environmentId)
    .get();
  const existingByKey = new Map(existing.docs.map((d) => [d.data().key as string, d]));

  const now = Date.now();
  const batch = db.batch();
  const seenKeys = new Set<string>();

  for (const v of variables) {
    seenKeys.add(v.key);
    const prev = existingByKey.get(v.key);
    if (prev) {
      const prevData = prev.data();
      if (prevData.encryptedValue === v.encryptedValue && prevData.isDeleted !== true) {
        continue; // unchanged
      }
      batch.update(prev.ref, {
        encryptedValue: v.encryptedValue,
        iv: v.iv,
        fingerprint: v.fingerprint,
        secretType: v.secretType ?? prevData.secretType ?? 'generic',
        description: v.description ?? prevData.description ?? '',
        isDeleted: false,
        version: (prevData.version ?? 1) + 1,
        updatedBy: uid,
        updatedAt: now,
      });
    } else {
      const ref = db.collection('variables').doc();
      batch.set(ref, {
        id: ref.id,
        organizationId,
        projectId,
        environmentId,
        key: v.key,
        encryptedValue: v.encryptedValue,
        iv: v.iv,
        fingerprint: v.fingerprint,
        algorithm: 'AES-256-GCM',
        secretType: v.secretType ?? 'generic',
        visibility: v.visibility ?? 'secret',
        description: v.description ?? '',
        isPinned: false,
        isFavorite: false,
        version: 1,
        revealCount: 0,
        createdBy: uid,
        updatedBy: uid,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      });
    }
  }

  // Soft-delete variables removed from the pushed set.
  let deleted = 0;
  for (const [key, doc] of existingByKey) {
    if (!seenKeys.has(key) && doc.data().isDeleted !== true) {
      batch.update(doc.ref, { isDeleted: true, deletedAt: now, deletedBy: uid, updatedAt: now });
      deleted += 1;
    }
  }

  await batch.commit();

  await db.doc(`environments/${environmentId}`).update({
    lastPushAt: now,
    lastPushChecksum: checksum,
    updatedAt: now,
  });

  await writeAudit(
    {
      organizationId,
      projectId,
      environmentId,
      action: 'environment.synced',
      actorId: uid,
      actorEmail: email,
      details: { direction: 'push', pushed: variables.length, softDeleted: deleted },
    },
    request,
  );

  return { ok: true, variableCount: variables.length, softDeleted: deleted, syncedAt: now };
});
