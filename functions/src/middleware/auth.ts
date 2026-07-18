// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Auth & permission helpers for callable functions
// ─────────────────────────────────────────────────────────────────────────────

import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { db, ADMIN_ROLES } from '../config';

export interface AuthedContext {
  uid: string;
  email: string;
}

/**
 * Assert the request is authenticated and the caller's global user account is
 * not disabled. Returns a minimal identity context.
 */
export async function requireActiveUser(
  request: CallableRequest,
): Promise<AuthedContext> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }
  const uid = request.auth.uid;
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('permission-denied', 'User account not found.');
  }
  if (userSnap.data()?.globalStatus === 'disabled') {
    throw new HttpsError('permission-denied', 'Your account has been disabled.');
  }
  return { uid, email: request.auth.token.email ?? userSnap.data()?.email ?? '' };
}

/**
 * Load the caller's organization membership and assert it is active.
 * Throws if the caller is not a member of the org.
 */
export async function requireOrgMembership(
  uid: string,
  organizationId: string,
): Promise<FirebaseFirestore.DocumentData> {
  const memberSnap = await db.doc(`organizationMembers/${organizationId}_${uid}`).get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this organization.');
  }
  const member = memberSnap.data()!;
  if (member.status !== 'active') {
    throw new HttpsError('permission-denied', 'Your organization membership is not active.');
  }
  return member;
}

/** Assert the caller holds an admin-tier role in the organization. */
export async function requireOrgAdmin(
  uid: string,
  organizationId: string,
): Promise<FirebaseFirestore.DocumentData> {
  const member = await requireOrgMembership(uid, organizationId);
  const roles: string[] = member.roleIds ?? [];
  if (!roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r))) {
    throw new HttpsError('permission-denied', 'Admin role required for this operation.');
  }
  return member;
}

/**
 * Resolve an environment by human-friendly slug within an organization, or by
 * document id. Returns the environment document; throws if not found.
 */
export async function resolveEnvironment(
  organizationId: string,
  ref: { environmentId?: string; environmentSlug?: string; projectId?: string },
): Promise<FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot> {
  if (ref.environmentId) {
    const snap = await db.doc(`environments/${ref.environmentId}`).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Environment not found.');
    if (snap.data()?.organizationId !== organizationId) {
      throw new HttpsError('permission-denied', 'Environment belongs to another organization.');
    }
    return snap;
  }

  if (!ref.environmentSlug) {
    throw new HttpsError('invalid-argument', 'environmentId or environmentSlug required.');
  }

  let query = db
    .collection('environments')
    .where('organizationId', '==', organizationId)
    .where('slug', '==', ref.environmentSlug);
  if (ref.projectId) query = query.where('projectId', '==', ref.projectId);

  const result = await query.limit(2).get();
  if (result.empty) {
    throw new HttpsError('not-found', `Environment "${ref.environmentSlug}" not found.`);
  }
  if (result.size > 1) {
    throw new HttpsError(
      'failed-precondition',
      `Multiple environments named "${ref.environmentSlug}". Specify projectId.`,
    );
  }
  return result.docs[0];
}
