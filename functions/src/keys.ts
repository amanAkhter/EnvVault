// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – User key registry callables
// Public keys are the only key material the server stores. Private keys never
// leave the user's device.
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, db } from './config';
import { requireActiveUser } from './middleware/auth';
import { requireString } from './middleware/validation';
import type { UserKeyDoc } from './types';

/**
 * registerUserKey — called on first CLI login (and on key rotation).
 * Stores the caller's RSA-OAEP public key. Overwriting an existing key is a
 * rotation: it invalidates every wrappedDEK the user holds, so the caller must
 * subsequently be re-granted (re-wrapped) for each environment by an admin.
 */
export const registerUserKey = onCall({ region: REGION }, async (request) => {
  const { uid } = await requireActiveUser(request);
  const publicKeyJwk = requireString(request.data?.publicKeyJwk, 'publicKeyJwk');

  // Validate it parses as JWK and is an RSA public key.
  try {
    const jwk = JSON.parse(publicKeyJwk);
    if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
      throw new Error('not an RSA public JWK');
    }
    if (jwk.d) {
      throw new HttpsError('invalid-argument', 'Refusing to store a private key.');
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('invalid-argument', 'publicKeyJwk is not valid JWK JSON.');
  }

  const ref = db.doc(`userKeys/${uid}`);
  const existing = await ref.get();
  const now = Date.now();
  const doc: UserKeyDoc = {
    userId: uid,
    publicKeyJwk,
    algorithm: 'RSA-OAEP-256',
    createdAt: existing.exists ? existing.data()!.createdAt : now,
    rotatedAt: existing.exists ? now : undefined,
  };
  await ref.set(doc, { merge: true });
  return { ok: true, rotated: existing.exists };
});

/**
 * getUserPublicKey — admin-facing. Fetches another user's public key so the
 * admin CLI can wrap an environment DEK for them during add-user.
 */
export const getUserPublicKey = onCall({ region: REGION }, async (request) => {
  await requireActiveUser(request);
  const email = requireString(request.data?.email, 'email').toLowerCase().trim();

  const userQuery = await db
    .collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();
  if (userQuery.empty) {
    throw new HttpsError('not-found', `No user found for ${email}.`);
  }
  const targetUid = userQuery.docs[0].id;
  const keySnap = await db.doc(`userKeys/${targetUid}`).get();
  if (!keySnap.exists) {
    throw new HttpsError(
      'failed-precondition',
      `${email} has not registered a key yet. They must run "envvault login" once.`,
    );
  }
  return {
    userId: targetUid,
    email,
    publicKeyJwk: (keySnap.data() as UserKeyDoc).publicKeyJwk,
  };
});
