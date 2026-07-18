// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – Crypto primitives (Node Web Crypto API)
// Byte-compatible with the browser encryption service:
//   - AES-256-GCM, 12-byte IV, base64 ciphertext + IV
//   - SHA-256 fingerprints, base64
//   - RSA-OAEP-256 for per-user DEK wrapping
// ─────────────────────────────────────────────────────────────────────────────

import { webcrypto } from 'node:crypto';

const crypto = webcrypto as unknown as Crypto;
const subtle = crypto.subtle;

const AES = 'AES-GCM';
const AES_LEN = 256;
const IV_LEN = 12;
const RSA = 'RSA-OAEP';

// Coerce any typed array into a plain ArrayBuffer-backed view. Node's Buffer
// and Web Crypto types diverge on the SharedArrayBuffer union under TS 5.7;
// copying into an explicitly ArrayBuffer-backed Uint8Array pins the type.
const buf = (input: Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> => {
  const view = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const ab = new ArrayBuffer(view.byteLength);
  const copy = new Uint8Array(ab);
  copy.set(view);
  return copy;
};

// ── base64 helpers ───────────────────────────────────────────────────────────
export const toBase64 = (b: Uint8Array): string => Buffer.from(b).toString('base64');
export const fromBase64 = (b64: string): Uint8Array<ArrayBuffer> => buf(new Uint8Array(Buffer.from(b64, 'base64')));
const encode = (s: string): Uint8Array<ArrayBuffer> => buf(new TextEncoder().encode(s));
const decode = (b: ArrayBuffer): string => new TextDecoder().decode(b);

// ── AES-256-GCM (variable values + DEK) ──────────────────────────────────────
export async function generateDEK(): Promise<CryptoKey> {
  return subtle.generateKey({ name: AES, length: AES_LEN }, true, ['encrypt', 'decrypt']);
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  return buf(new Uint8Array(await subtle.exportKey('raw', key)));
}

export async function importRawKey(raw: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey('raw', buf(raw), { name: AES, length: AES_LEN }, true, ['encrypt', 'decrypt']);
}

export interface Encrypted {
  ciphertext: string;
  iv: string;
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<Encrypted> {
  const iv = buf(crypto.getRandomValues(new Uint8Array(IV_LEN)));
  const ct = await subtle.encrypt({ name: AES, iv }, key, encode(plaintext));
  return { ciphertext: toBase64(new Uint8Array(ct)), iv: toBase64(iv) };
}

export async function decrypt(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const pt = await subtle.decrypt({ name: AES, iv: fromBase64(iv) }, key, fromBase64(ciphertext));
  return decode(pt);
}

export async function fingerprint(plaintext: string): Promise<string> {
  const hash = await subtle.digest('SHA-256', encode(plaintext));
  return toBase64(new Uint8Array(hash));
}

// ── RSA-OAEP (per-user DEK wrapping) ─────────────────────────────────────────
export async function generateUserKeypair(): Promise<{ publicKeyJwk: string; privateKeyJwk: string }> {
  const pair = await subtle.generateKey(
    {
      name: RSA,
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );
  const publicKeyJwk = await subtle.exportKey('jwk', pair.publicKey);
  const privateKeyJwk = await subtle.exportKey('jwk', pair.privateKey);
  return {
    publicKeyJwk: JSON.stringify(publicKeyJwk),
    privateKeyJwk: JSON.stringify(privateKeyJwk),
  };
}

async function importPublicKey(jwk: string): Promise<CryptoKey> {
  return subtle.importKey('jwk', JSON.parse(jwk), { name: RSA, hash: 'SHA-256' }, false, ['encrypt']);
}

async function importPrivateKey(jwk: string): Promise<CryptoKey> {
  return subtle.importKey('jwk', JSON.parse(jwk), { name: RSA, hash: 'SHA-256' }, false, ['decrypt']);
}

/** Wrap a DEK with a user's RSA public key → base64 blob stored server-side. */
export async function wrapDEKForUser(dek: CryptoKey, publicKeyJwk: string): Promise<string> {
  const raw = await exportRawKey(dek);
  const pub = await importPublicKey(publicKeyJwk);
  const wrapped = await subtle.encrypt({ name: RSA }, pub, buf(raw));
  return toBase64(new Uint8Array(wrapped));
}

/** Unwrap a DEK the server handed us, using our local RSA private key. */
export async function unwrapDEK(wrappedDEK: string, privateKeyJwk: string): Promise<CryptoKey> {
  const priv = await importPrivateKey(privateKeyJwk);
  const raw = await subtle.decrypt({ name: RSA }, priv, fromBase64(wrappedDEK));
  return importRawKey(new Uint8Array(raw));
}
