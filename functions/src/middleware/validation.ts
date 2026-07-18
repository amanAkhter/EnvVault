// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Lightweight input validation for callable payloads
// Keeps a hard dependency-free boundary check without pulling zod into the
// functions runtime.
// ─────────────────────────────────────────────────────────────────────────────

import { HttpsError } from 'firebase-functions/v2/https';
import type { EncryptedVariablePayload } from '../types';

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `"${field}" must be a non-empty string.`);
  }
  return value;
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `"${field}" must be a string.`);
  }
  return value;
}

export function requireEmail(value: unknown, field: string): string {
  const email = requireString(value, field).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', `"${field}" is not a valid email.`);
  }
  return email;
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Validate an array of encrypted variables sent by the CLI push command.
 * Rejects any payload carrying a plaintext `value` field — the server must
 * never receive plaintext.
 */
export function validateEncryptedVariables(value: unknown): EncryptedVariablePayload[] {
  if (!Array.isArray(value)) {
    throw new HttpsError('invalid-argument', '"variables" must be an array.');
  }
  if (value.length > 2000) {
    throw new HttpsError('invalid-argument', 'Too many variables (max 2000).');
  }
  return value.map((raw, i) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new HttpsError('invalid-argument', `variables[${i}] must be an object.`);
    }
    const v = raw as Record<string, unknown>;
    if ('value' in v) {
      throw new HttpsError('invalid-argument', `variables[${i}] must not contain plaintext "value".`);
    }
    const key = requireString(v.key, `variables[${i}].key`);
    if (!KEY_RE.test(key)) {
      throw new HttpsError('invalid-argument', `variables[${i}].key "${key}" is not a valid env key.`);
    }
    return {
      key,
      encryptedValue: requireString(v.encryptedValue, `variables[${i}].encryptedValue`),
      iv: requireString(v.iv, `variables[${i}].iv`),
      fingerprint: requireString(v.fingerprint, `variables[${i}].fingerprint`),
      secretType: optionalString(v.secretType, `variables[${i}].secretType`),
      visibility: v.visibility === 'plain' ? 'plain' : 'secret',
      description: optionalString(v.description, `variables[${i}].description`),
    };
  });
}
