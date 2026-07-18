// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – Persistent configuration & credential store
//
// Two stores:
//   - `config`  : Firebase project config + user preferences (plaintext, safe).
//   - `secrets` : refresh token + private key JWK (encrypted at rest by `conf`).
//
// `conf` encrypts the secrets store with a machine-local key. This is not a
// hardware keychain, but it keeps credentials out of plaintext on disk and is
// portable across macOS / Windows / Linux without native modules.
// ─────────────────────────────────────────────────────────────────────────────

import Conf from 'conf';
import { hostname, userInfo } from 'node:os';

export interface FirebaseProjectConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  region: string;
}

export interface SessionState {
  uid: string;
  email: string;
  displayName?: string;
  organizationId: string;
  refreshToken: string;
  /** RSA-OAEP private key as JWK JSON. Never leaves this machine. */
  privateKeyJwk: string;
  publicKeyJwk: string;
  loggedInAt: number;
}

// Default project config baked in for the hosted EnvVault service. Override via
// `envvault config set` or ENVVAULT_* env vars for self-hosted deployments.
const DEFAULT_PROJECT: FirebaseProjectConfig = {
  apiKey: process.env.ENVVAULT_API_KEY ?? '',
  authDomain: process.env.ENVVAULT_AUTH_DOMAIN ?? '',
  projectId: process.env.ENVVAULT_PROJECT_ID ?? 'env-handler',
  appId: process.env.ENVVAULT_APP_ID ?? '',
  region: process.env.ENVVAULT_REGION ?? 'us-central1',
};

const configStore = new Conf<{ project: FirebaseProjectConfig }>({
  projectName: 'envvault',
  configName: 'config',
  defaults: { project: DEFAULT_PROJECT },
});

const secretStore = new Conf<{ session?: SessionState }>({
  projectName: 'envvault',
  configName: 'secrets',
  encryptionKey: 'envvault-local-secret-store-v1',
});

export function getProjectConfig(): FirebaseProjectConfig {
  const stored = configStore.get('project');
  // Env vars always win so CI can inject config without writing to disk.
  return {
    apiKey: process.env.ENVVAULT_API_KEY ?? stored.apiKey,
    authDomain: process.env.ENVVAULT_AUTH_DOMAIN ?? stored.authDomain,
    projectId: process.env.ENVVAULT_PROJECT_ID ?? stored.projectId,
    appId: process.env.ENVVAULT_APP_ID ?? stored.appId,
    region: process.env.ENVVAULT_REGION ?? stored.region,
  };
}

export function setProjectConfig(patch: Partial<FirebaseProjectConfig>): void {
  configStore.set('project', { ...configStore.get('project'), ...patch });
}

export function getSession(): SessionState | undefined {
  return secretStore.get('session');
}

export function setSession(session: SessionState): void {
  secretStore.set('session', session);
}

export function clearSession(): void {
  secretStore.delete('session');
}

export function deviceName(): string {
  try {
    return `${userInfo().username}@${hostname()}`;
  } catch {
    return 'unknown-device';
  }
}
