// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – CLI keys & session service
// Reads the current user's registered public key and CLI device sessions.
// These documents are written server-side (callable functions); the web app
// only reads them and can revoke a session.
// ─────────────────────────────────────────────────────────────────────────────

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { callFunction } from '../functions';

export interface UserPublicKey {
  publicKeyJwk: string;
  algorithm: string;
  createdAt: number;
  rotatedAt?: number;
}

export interface CliSession {
  id: string;
  deviceName: string;
  deviceFingerprint: string;
  status: 'active' | 'revoked';
  createdAt: number;
  lastActiveAt: number;
  revokedAt?: number;
}

/** Fetch the current user's registered public key, if any. */
export const getUserPublicKey = async (userId: string): Promise<UserPublicKey | null> => {
  const snap = await getDoc(doc(db, 'userKeys', userId));
  return snap.exists() ? (snap.data() as UserPublicKey) : null;
};

/** A short, human-comparable fingerprint of a JWK public key. */
export const keyFingerprint = async (publicKeyJwk: string): Promise<string> => {
  const bytes = new TextEncoder().encode(publicKeyJwk);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Grouped for readability, e.g. "3f2a:9c11:…".
  return hex.slice(0, 32).match(/.{1,4}/g)!.join(':');
};

/** List the current user's CLI device sessions, newest first. */
export const listCliSessions = async (userId: string): Promise<CliSession[]> => {
  const q = query(collection(db, 'cliSessions'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<CliSession, 'id'>) }))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
};

/** Revoke a CLI session via the server callable (client writes are blocked). */
export const revokeCliSession = async (sessionId: string): Promise<void> => {
  await callFunction<{ sessionId: string }, { ok: boolean }>('revokeCliSession', { sessionId });
};
