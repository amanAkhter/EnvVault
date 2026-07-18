// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – Firebase Auth (REST) + Callable Functions (raw HTTPS)
//
// The CLI needs no Firebase SDK. It authenticates against the Identity Toolkit
// REST API, persists only the refresh token, and invokes backend callables over
// their documented HTTPS protocol (POST { data }, Bearer ID token → { result }).
// ─────────────────────────────────────────────────────────────────────────────

import { getProjectConfig } from './config.js';

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';
const SECURETOKEN = 'https://securetoken.googleapis.com/v1';

export interface AuthTokens {
  idToken: string;
  refreshToken: string;
  uid: string;
  email: string;
  displayName?: string;
}

interface RestError {
  error?: { message?: string };
}

async function restCall<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & RestError;
  if (!res.ok) {
    throw new Error(mapAuthError(json.error?.message ?? `HTTP ${res.status}`));
  }
  return json;
}

function mapAuthError(code: string): string {
  const map: Record<string, string> = {
    EMAIL_NOT_FOUND: 'No account found for that email.',
    INVALID_PASSWORD: 'Incorrect password.',
    INVALID_LOGIN_CREDENTIALS: 'Invalid email or password.',
    USER_DISABLED: 'This account has been disabled.',
    TOKEN_EXPIRED: 'Session expired. Run "envvault login" again.',
    INVALID_REFRESH_TOKEN: 'Session invalid. Run "envvault login" again.',
  };
  for (const [k, v] of Object.entries(map)) {
    if (code.startsWith(k)) return v;
  }
  return code;
}

/** Email/password sign-in via the Identity Toolkit REST API. */
export async function signInWithPassword(email: string, password: string): Promise<AuthTokens> {
  const { apiKey } = getProjectConfig();
  if (!apiKey) throw new Error('No Firebase apiKey configured. Run "envvault config set --api-key <key>".');
  const data = await restCall<{
    idToken: string;
    refreshToken: string;
    localId: string;
    email: string;
    displayName?: string;
  }>(`${IDENTITY}/accounts:signInWithPassword?key=${apiKey}`, {
    email,
    password,
    returnSecureToken: true,
  });
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    uid: data.localId,
    email: data.email,
    displayName: data.displayName,
  };
}

/** Exchange a stored refresh token for a fresh ID token. */
export async function refreshIdToken(
  refreshToken: string,
): Promise<{ idToken: string; refreshToken: string; uid: string }> {
  const { apiKey } = getProjectConfig();
  const data = await restCall<{ id_token: string; refresh_token: string; user_id: string }>(
    `${SECURETOKEN}/token?key=${apiKey}`,
    { grant_type: 'refresh_token', refresh_token: refreshToken },
  );
  return { idToken: data.id_token, refreshToken: data.refresh_token, uid: data.user_id };
}

function callableBase(): string {
  const cfg = getProjectConfig();
  return process.env.ENVVAULT_EMULATOR
    ? `http://127.0.0.1:5001/${cfg.projectId}/${cfg.region}`
    : `https://${cfg.region}-${cfg.projectId}.cloudfunctions.net`;
}

/** Invoke a backend callable function with the given ID token. */
export async function callFunction<TReq, TRes>(
  name: string,
  idToken: string,
  payload: TReq,
): Promise<TRes> {
  const res = await fetch(`${callableBase()}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: payload }),
  });

  let json: { result?: TRes; error?: { message?: string; status?: string } };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new Error(`Function ${name} returned a non-JSON response (HTTP ${res.status}).`);
  }
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Function "${name}" failed (HTTP ${res.status}).`);
  }
  return json.result as TRes;
}
