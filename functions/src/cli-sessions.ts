// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – CLI session management callables
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, db } from './config';
import { requireActiveUser } from './middleware/auth';
import { requireString } from './middleware/validation';
import { writeAudit } from './middleware/audit';
import type { CliSessionDoc } from './types';

/** revokeCliSession — the owner revokes one of their CLI device sessions. */
export const revokeCliSession = onCall({ region: REGION }, async (request) => {
  const { uid, email } = await requireActiveUser(request);
  const sessionId = requireString(request.data?.sessionId, 'sessionId');

  const ref = db.doc(`cliSessions/${sessionId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Session not found.');
  const session = snap.data() as CliSessionDoc;
  if (session.userId !== uid) {
    throw new HttpsError('permission-denied', 'You can only revoke your own sessions.');
  }

  await ref.update({ status: 'revoked', revokedAt: Date.now() });
  await writeAudit(
    {
      organizationId: request.data?.organizationId ?? 'unknown',
      action: 'auth.logout',
      actorId: uid,
      actorEmail: email,
      details: { sessionId, deviceName: session.deviceName, reason: 'cli_session_revoked' },
    },
    request,
  );
  return { ok: true };
});
