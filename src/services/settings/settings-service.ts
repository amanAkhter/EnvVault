// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Settings service
// Writes to the organization and user profile documents from the web app.
// Organization security settings (including the audit-logging toggle) are
// merged so partial updates never clobber sibling fields.
// ─────────────────────────────────────────────────────────────────────────────

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Organization, OrganizationSecurity, User } from '../../types';

export interface OrganizationProfileUpdate {
  name?: string;
  description?: string;
  website?: string;
  logoUrl?: string;
}

/** Update mutable organization profile fields. */
export const updateOrganizationProfile = async (
  organizationId: string,
  patch: OrganizationProfileUpdate,
): Promise<void> => {
  const clean = pruneUndefined({ ...patch, updatedAt: Date.now() });
  await updateDoc(doc(db, 'organizations', organizationId), clean);
};

/** Merge-update organization security settings (partial). */
export const updateOrganizationSecurity = async (
  organizationId: string,
  patch: Partial<OrganizationSecurity>,
): Promise<OrganizationSecurity> => {
  const ref = doc(db, 'organizations', organizationId);
  const snap = await getDoc(ref);
  const current = (snap.data() as Organization | undefined)?.security ?? {
    requireReauthForReveal: true,
    sessionTimeoutMinutes: 60,
    clipboardTimeoutSeconds: 30,
    allowedIpRanges: [],
  };
  const merged: OrganizationSecurity = { ...current, ...patch };
  await setDoc(ref, { security: merged, updatedAt: Date.now() }, { merge: true });
  return merged;
};

export interface UserProfileUpdate {
  name?: string;
  photoURL?: string;
}

/** Update the signed-in user's profile fields. */
export const updateUserProfile = async (
  userId: string,
  patch: UserProfileUpdate,
): Promise<void> => {
  const clean = pruneUndefined({ ...patch, updatedAt: Date.now() });
  await updateDoc(doc(db, 'users', userId), clean);
};

const pruneUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
};

export type { User };
