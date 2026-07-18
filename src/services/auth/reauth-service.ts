// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Step-up Re-authentication Service
// Forces a fresh Google credential before revealing production secrets.
// A successful reauth is cached for a short window so a user isn't prompted
// on every reveal within the same sensitive session.
// ─────────────────────────────────────────────────────────────────────────────

import { reauthenticateGoogle } from '../../features/auth/api/authApi';
import { logAuditEvent, type AuditContext } from '../audit/audit-service';

/** How long a successful reauth stays valid (5 minutes). */
export const REAUTH_TTL_MS = 5 * 60 * 1000;

let lastReauthAt = 0;

/** Whether a recent reauth is still within its validity window. */
export const isReauthFresh = (): boolean => Date.now() - lastReauthAt < REAUTH_TTL_MS;

/** Invalidate any cached reauth (e.g. on logout). */
export const clearReauth = (): void => {
  lastReauthAt = 0;
};

/**
 * Ensure the user has a fresh credential. If a recent reauth is still valid,
 * this is a no-op. Otherwise it triggers a Google popup and, on success,
 * records the step-up and logs an audit event.
 *
 * @throws if the popup is dismissed or reauth fails.
 */
export const ensureReauthenticated = async (
  auditCtx: AuditContext,
  reason: string,
): Promise<void> => {
  if (isReauthFresh()) return;

  await reauthenticateGoogle();
  lastReauthAt = Date.now();

  await logAuditEvent(auditCtx, 'auth.reauthenticated', { reason });
};
