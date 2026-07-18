// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Cloud Functions client
// Thin typed wrapper over the Firebase callable functions used by the web app.
// Keeps SDK wiring out of components — features call these helpers instead.
// ─────────────────────────────────────────────────────────────────────────────

import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

const REGION = 'us-central1';

const functions = getFunctions(getApp(), REGION);

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

/** Invoke a callable by name and return its typed result. */
export async function callFunction<TReq, TRes>(name: string, payload: TReq): Promise<TRes> {
  const callable = httpsCallable<TReq, TRes>(functions, name);
  const res = await callable(payload);
  return res.data;
}

// ── Typed callable helpers ───────────────────────────────────────────────────

export interface DeleteEnvironmentInput {
  organizationId: string;
  environmentId?: string;
  environmentSlug?: string;
  projectId?: string;
}

export interface DeleteEnvironmentResult {
  ok: boolean;
  deletedVariables: number;
  deletedVersions: number;
}

/** Hard-delete an environment and all its variables, versions, keys, members. */
export const deleteEnvironmentFn = (input: DeleteEnvironmentInput) =>
  callFunction<DeleteEnvironmentInput, DeleteEnvironmentResult>('deleteEnvironment', input);
