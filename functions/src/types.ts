// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Firestore document types
// Mirrors the client `src/types` but scoped to server-managed collections that
// power the CLI: per-user keys, per-environment membership, and CLI sessions.
// ─────────────────────────────────────────────────────────────────────────────

export type EnvironmentMemberStatus = 'active' | 'inactive' | 'removed';

/**
 * userKeys/{userId}
 * The user's public key. The matching private key never leaves the user's
 * machine (CLI keychain) or browser (IndexedDB).
 */
export interface UserKeyDoc {
  userId: string;
  /** RSA-OAEP public key exported as JWK, JSON-stringified. */
  publicKeyJwk: string;
  algorithm: 'RSA-OAEP-256';
  createdAt: number;
  rotatedAt?: number;
}

/**
 * environmentMembers/{environmentId}_{userId}
 * Grants one user access to one environment. Holds that user's copy of the
 * environment DEK, wrapped with their RSA public key. Revoking = flipping
 * status and deleting `wrappedDEK`.
 */
export interface EnvironmentMemberDoc {
  id: string;
  environmentId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  email: string;
  /** Environment DEK encrypted with this user's RSA-OAEP public key (base64). */
  wrappedDEK: string | null;
  /** Version of the environment DEK this wrap corresponds to. */
  keyVersion: number;
  status: EnvironmentMemberStatus;
  lastSyncAt: number | null;
  lastSyncChecksum: string | null;
  grantedBy: string;
  grantedAt: number;
  revokedBy?: string;
  revokedAt?: number;
}

/**
 * environmentKeys/{environmentId}
 * Tracks the current DEK version for an environment. The raw DEK is never
 * stored here — only per-member wrapped copies exist. This document lets the
 * server detect stale wraps and coordinate rotation.
 */
export interface EnvironmentKeyDoc {
  environmentId: string;
  organizationId: string;
  keyVersion: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * cliSessions/{sessionId}
 * One row per CLI login. We never store the refresh token — only a hash — so a
 * Firestore leak cannot be replayed. Revoking a session forces re-login.
 */
export interface CliSessionDoc {
  id: string;
  userId: string;
  email: string;
  deviceName: string;
  deviceFingerprint: string;
  refreshTokenHash: string;
  status: 'active' | 'revoked';
  createdAt: number;
  lastActiveAt: number;
  revokedAt?: number;
}

/** Encrypted variable payload exchanged with the CLI over callable functions. */
export interface EncryptedVariablePayload {
  key: string;
  encryptedValue: string;
  iv: string;
  fingerprint: string;
  secretType?: string;
  visibility?: 'plain' | 'secret';
  description?: string;
}
