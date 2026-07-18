// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Firebase Admin initialization + shared singletons
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();

// Region for all callable/HTTP functions. Keep in sync with the CLI + frontend.
export const REGION = 'us-central1';

// Sync freshness window. A locally cached `.env` older than this must be
// re-fetched, and the server refreshes membership.lastSyncAt on every fetch.
export const SYNC_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Roles permitted to perform admin environment operations from the CLI.
export const ADMIN_ROLES = ['owner', 'admin', 'devops'] as const;
