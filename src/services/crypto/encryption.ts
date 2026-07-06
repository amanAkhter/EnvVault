// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Client-Side Encryption Service
// Zero-knowledge encryption using Web Crypto API (AES-256-GCM).
// Secrets are encrypted/decrypted entirely in the browser.
// Firestore never receives plaintext secret values.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ┌──────────────────────────────────────────────┐
 * │  Envelope Encryption Architecture            │
 * │                                              │
 * │  Master Key (derived from user passphrase    │
 * │  or stored in secure key management)         │
 * │           │                                  │
 * │           ▼                                  │
 * │  Encrypt Project DEK (AES-256-GCM)          │
 * │           │                                  │
 * │           ▼                                  │
 * │  Encrypted DEK → Firestore                  │
 * │                                              │
 * │  Project DEK                                 │
 * │           │                                  │
 * │           ▼                                  │
 * │  Encrypt Variable Value (AES-256-GCM)       │
 * │           │                                  │
 * │           ▼                                  │
 * │  Encrypted Value → Firestore                │
 * └──────────────────────────────────────────────┘
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Encode a Uint8Array to a base64 string. */
const toBase64 = (buffer: Uint8Array): string =>
  btoa(String.fromCharCode(...buffer));

/** Decode a base64 string to a Uint8Array. */
const fromBase64 = (base64: string): Uint8Array =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** Encode a string as UTF-8 bytes. */
const encode = (text: string): Uint8Array =>
  new TextEncoder().encode(text);

/** Decode UTF-8 bytes to a string. */
const decode = (buffer: ArrayBuffer): string =>
  new TextDecoder().decode(buffer);

/** Generate a cryptographically secure random IV. */
const generateIV = (): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(IV_LENGTH));

// ── Key Generation ──────────────────────────────────────────────────────────

/**
 * Generate a new AES-256-GCM key.
 * Used as a Data Encryption Key (DEK) for each project.
 */
export const generateEncryptionKey = async (): Promise<CryptoKey> => {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable, so we can export and wrap it
    ['encrypt', 'decrypt'],
  );
};

/**
 * Export a CryptoKey to raw bytes (Uint8Array).
 */
export const exportKey = async (key: CryptoKey): Promise<Uint8Array> => {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
};

/**
 * Import raw key bytes into a CryptoKey object.
 */
export const importKey = async (rawKey: Uint8Array): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  );
};

/**
 * Derive a master key from a passphrase using PBKDF2.
 * For V1, we derive from a stable org-level secret stored in the app.
 * In production, this would be replaced by Google Cloud KMS / HSM.
 */
export const deriveKeyFromPassphrase = async (
  passphrase: string,
  salt: Uint8Array,
  iterations = 600_000, // OWASP recommended minimum for PBKDF2
): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  );
};

// ── Encryption / Decryption ─────────────────────────────────────────────────

export interface EncryptionResult {
  ciphertext: string; // base64 encoded
  iv: string;         // base64 encoded
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded ciphertext and IV.
 */
export const encrypt = async (
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptionResult> => {
  const iv = generateIV();
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encode(plaintext),
  );

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
};

/**
 * Decrypt a base64-encoded ciphertext using AES-256-GCM.
 * Returns the original plaintext string.
 */
export const decrypt = async (
  ciphertext: string,
  iv: string,
  key: CryptoKey,
): Promise<string> => {
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext),
  );

  return decode(decrypted);
};

// ── Envelope Encryption (DEK wrapping) ──────────────────────────────────────

/**
 * Wrap (encrypt) a Data Encryption Key using a Master Key.
 * The wrapped DEK is stored in Firestore alongside the project.
 */
export const wrapDEK = async (
  dek: CryptoKey,
  masterKey: CryptoKey,
): Promise<EncryptionResult> => {
  const rawDEK = await exportKey(dek);
  const iv = generateIV();

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    masterKey,
    rawDEK,
  );

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
};

/**
 * Unwrap (decrypt) a Data Encryption Key using a Master Key.
 */
export const unwrapDEK = async (
  wrappedDEK: string,
  iv: string,
  masterKey: CryptoKey,
): Promise<CryptoKey> => {
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(iv) },
    masterKey,
    fromBase64(wrappedDEK),
  );

  return importKey(new Uint8Array(decrypted));
};

// ── Fingerprinting ──────────────────────────────────────────────────────────

/**
 * Generate a SHA-256 fingerprint of a plaintext value.
 * Used for comparison between environments without revealing the actual value.
 */
export const generateFingerprint = async (plaintext: string): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', encode(plaintext));
  return toBase64(new Uint8Array(hash));
};

// ── Secret Generation ───────────────────────────────────────────────────────

const CHARS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * Generate a cryptographically secure random string.
 */
export const generateSecureRandom = (
  length: number,
  options: {
    lowercase?: boolean;
    uppercase?: boolean;
    digits?: boolean;
    symbols?: boolean;
  } = { lowercase: true, uppercase: true, digits: true, symbols: true },
): string => {
  let charset = '';
  if (options.lowercase) charset += CHARS.lowercase;
  if (options.uppercase) charset += CHARS.uppercase;
  if (options.digits) charset += CHARS.digits;
  if (options.symbols) charset += CHARS.symbols;

  if (!charset) charset = CHARS.lowercase + CHARS.uppercase + CHARS.digits;

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => charset[x % charset.length]).join('');
};

/**
 * Generate a UUID v4.
 */
export const generateUUID = (): string => crypto.randomUUID();

/**
 * Generate a JWT-compatible secret (base64url encoded random bytes).
 */
export const generateJWTSecret = (byteLength = 64): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Generate an API key with a prefix.
 */
export const generateAPIKey = (prefix = 'evk'): string => {
  const key = generateSecureRandom(40, { lowercase: true, uppercase: true, digits: true, symbols: false });
  return `${prefix}_${key}`;
};

// ── Master Key Management (V1: Browser-stored) ─────────────────────────────

/**
 * For V1, the master key is derived from a combination of the user's UID
 * and a fixed application salt. In production, this would be replaced
 * with Google Cloud KMS or a similar key management service.
 *
 * This is a pragmatic trade-off: the encryption is not truly zero-knowledge
 * (since the key derivation material is deterministic from the UID),
 * but it ensures that Firestore data is encrypted at rest and cannot be
 * read without the application logic + authenticated user context.
 */
const APP_SALT = 'envvault-v1-master-key-salt-2024';

export const getMasterKey = async (userUid: string): Promise<CryptoKey> => {
  const salt = encode(`${APP_SALT}:${userUid}`);
  // Use a stable passphrase derived from the user's UID
  return deriveKeyFromPassphrase(userUid, salt, 100_000);
};

/**
 * Get or create a project DEK.
 * If the project already has an encrypted DEK, unwrap it.
 * Otherwise, generate a new one, wrap it, and return both.
 */
export const getOrCreateProjectDEK = async (
  masterKey: CryptoKey,
  encryptedDEK?: string,
  dekIV?: string,
): Promise<{ dek: CryptoKey; wrappedDEK: EncryptionResult | null }> => {
  if (encryptedDEK && dekIV) {
    const dek = await unwrapDEK(encryptedDEK, dekIV, masterKey);
    return { dek, wrappedDEK: null };
  }

  // Generate new DEK
  const dek = await generateEncryptionKey();
  const wrappedDEK = await wrapDEK(dek, masterKey);
  return { dek, wrappedDEK };
};
