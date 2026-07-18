// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Firestore triggers + reveal audit
// (Previously the entire index.ts; now uses the shared admin/db singleton.)
// ─────────────────────────────────────────────────────────────────────────────

import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { REGION, db } from './config';

// ── onUserSignup ─────────────────────────────────────────────────────────────
// Provisions the default organization and owner membership when a `users`
// document is first created.
export const onUserSignup = onDocumentCreated('users/{userId}', async (event) => {
  const user = event.data?.data();
  const userId = event.params.userId;
  if (!user) return;

  const orgId = `org_${userId}`;
  const orgRef = db.doc(`organizations/${orgId}`);
  const memberRef = db.doc(`organizationMembers/${orgId}_${userId}`);
  const now = Date.now();

  const existing = await orgRef.get();
  if (existing.exists) return;

  const batch = db.batch();
  batch.set(orgRef, {
    id: orgId,
    name: `${user.name ?? 'New'}'s Workspace`,
    slug: `workspace-${userId.slice(0, 8)}`,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    billingPlanId: 'free',
    status: 'active',
    security: {
      requireReauthForReveal: true,
      sessionTimeoutMinutes: 60,
      clipboardTimeoutSeconds: 30,
      allowedIpRanges: [],
    },
  });
  batch.set(memberRef, {
    id: `${orgId}_${userId}`,
    organizationId: orgId,
    userId,
    email: user.email ?? '',
    displayName: user.name ?? 'Owner',
    roleIds: ['owner'],
    status: 'active',
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await batch.commit();
  logger.info(`Provisioned org ${orgId} for user ${userId}`);
});

// ── onVariableChange ─────────────────────────────────────────────────────────
// Server-authored version history + audit entry on any variable value change.
export const onVariableChange = onDocumentWritten('variables/{variableId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after) return;

  const valueChanged = before && before.encryptedValue !== after.encryptedValue;
  if (!valueChanged) return;

  const versionRef = db.collection('versions').doc();
  await versionRef.set({
    id: versionRef.id,
    variableId: event.params.variableId,
    projectId: after.projectId,
    environmentId: after.environmentId,
    organizationId: after.organizationId,
    version: after.version,
    oldEncryptedValue: before.encryptedValue,
    oldIV: before.iv,
    oldFingerprint: before.fingerprint,
    newEncryptedValue: after.encryptedValue,
    newIV: after.iv,
    newFingerprint: after.fingerprint,
    reason: 'server-recorded',
    userId: after.updatedBy,
    userEmail: '',
    timestamp: Date.now(),
  });

  await db.collection('auditLogs').add({
    organizationId: after.organizationId,
    projectId: after.projectId,
    environmentId: after.environmentId,
    action: 'variable.updated',
    actorId: after.updatedBy,
    actorEmail: '',
    details: { variableKey: after.key, version: after.version, source: 'cloud-function' },
    timestamp: Date.now(),
  });
});

// ── onSecretReveal ───────────────────────────────────────────────────────────
export const onSecretReveal = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }
  const { organizationId, projectId, environmentId, variableKey, intent } = request.data ?? {};
  if (!organizationId || !variableKey) {
    throw new HttpsError('invalid-argument', 'organizationId and variableKey are required.');
  }

  await db.collection('auditLogs').add({
    organizationId,
    projectId: projectId ?? null,
    environmentId: environmentId ?? null,
    action: 'variable.revealed',
    actorId: request.auth.uid,
    actorEmail: request.auth.token.email ?? '',
    details: { variableKey, intent: intent ?? 'unspecified' },
    ip: request.rawRequest.ip,
    userAgent: request.rawRequest.headers['user-agent'] ?? '',
    timestamp: Date.now(),
  });

  return { ok: true };
});

// ── cleanupExpiredSecrets ────────────────────────────────────────────────────
export const cleanupExpiredSecrets = onSchedule(
  { region: REGION, schedule: '0 3 * * *' },
  async () => {
    const now = Date.now();
    const expired = await db
      .collection('variables')
      .where('expirationDate', '<=', now)
      .where('isDeleted', '!=', true)
      .get();

    const batch = db.batch();
    for (const doc of expired.docs) {
      const v = doc.data();
      batch.update(doc.ref, { isExpiredFlagged: true, updatedAt: now });
      const noteRef = db.collection('notifications').doc();
      batch.set(noteRef, {
        id: noteRef.id,
        organizationId: v.organizationId,
        userId: v.createdBy,
        type: 'secret_expired',
        title: 'Secret expired',
        message: `${v.key} has passed its expiration date.`,
        actionUrl: `/projects/${v.projectId}`,
        isRead: false,
        createdAt: now,
      });
    }
    await batch.commit();
    logger.info(`Flagged ${expired.size} expired secrets.`);
  },
);

// ── sendNotifications ────────────────────────────────────────────────────────
export const sendNotifications = onDocumentCreated('auditLogs/{logId}', async (event) => {
  const log = event.data?.data();
  if (!log) return;

  const CRITICAL: Record<string, string> = {
    'member.invited': 'A new member was invited to your workspace.',
    'member.removed': 'A member was removed from an environment.',
    'variable.rollback': 'A variable was rolled back to a previous version.',
    'auth.login_failed': 'A failed sign-in attempt was recorded.',
  };
  const message = CRITICAL[log.action];
  if (!message) return;

  const admins = await db
    .collection('organizationMembers')
    .where('organizationId', '==', log.organizationId)
    .where('status', '==', 'active')
    .get();

  const batch = db.batch();
  for (const m of admins.docs) {
    const member = m.data();
    if (!member.roleIds?.some((r: string) => ['owner', 'admin'].includes(r))) continue;
    const ref = db.collection('notifications').doc();
    batch.set(ref, {
      id: ref.id,
      organizationId: log.organizationId,
      userId: member.userId,
      type: 'security_alert',
      title: 'Security event',
      message,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
});
