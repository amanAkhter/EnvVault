// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – Session helpers
// Resolves a fresh ID token for the logged-in user on every command, rotating
// the stored refresh token as Firebase returns new ones.
// ─────────────────────────────────────────────────────────────────────────────

import { getSession, setSession, clearSession, type SessionState } from './config.js';
import { refreshIdToken } from './firebase.js';

export interface ActiveSession {
  idToken: string;
  session: SessionState;
}

/** Require a logged-in user and return a fresh ID token. Exits if none. */
export async function requireSession(): Promise<ActiveSession> {
  const session = getSession();
  if (!session) {
    throw new Error('Not logged in. Run "envvault login" first.');
  }
  try {
    const refreshed = await refreshIdToken(session.refreshToken);
    if (refreshed.refreshToken !== session.refreshToken) {
      setSession({ ...session, refreshToken: refreshed.refreshToken });
    }
    return { idToken: refreshed.idToken, session: getSession()! };
  } catch (err) {
    // Refresh token no longer valid — force re-login.
    clearSession();
    throw new Error((err as Error).message + ' You have been logged out.');
  }
}
