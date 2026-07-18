// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Environment Comparison Engine
// Diffs variables across two environments using SHA-256 fingerprints.
// Never decrypts: comparison is zero-knowledge (fingerprint equality only).
// ─────────────────────────────────────────────────────────────────────────────

import type { Variable, EnvironmentComparisonResult } from '../../types';

export type ComparisonStatus = EnvironmentComparisonResult['status'];

export interface ComparisonSummary {
  rows: EnvironmentComparisonResult[];
  identical: number;
  different: number;
  missingInSource: number;
  missingInTarget: number;
  total: number;
}

/**
 * Compare two sets of variables (source vs target environment).
 *
 * Uses `fingerprint` (SHA-256 of plaintext) so values never leave storage
 * encrypted form. `sourceValue`/`targetValue` are intentionally omitted here;
 * the UI decrypts on-demand only when the user explicitly requests a reveal.
 */
export const compareEnvironments = (
  sourceVars: Variable[],
  targetVars: Variable[],
): ComparisonSummary => {
  const sourceMap = new Map(sourceVars.map((v) => [v.key, v]));
  const targetMap = new Map(targetVars.map((v) => [v.key, v]));
  const keys = new Set<string>([...sourceMap.keys(), ...targetMap.keys()]);

  const rows: EnvironmentComparisonResult[] = [];

  for (const key of Array.from(keys).sort((a, b) => a.localeCompare(b))) {
    const source = sourceMap.get(key);
    const target = targetMap.get(key);

    let status: ComparisonStatus;
    if (source && !target) status = 'missing_in_target';
    else if (!source && target) status = 'missing_in_source';
    else if (source!.fingerprint === target!.fingerprint) status = 'identical';
    else status = 'different';

    rows.push({
      key,
      sourceFingerprint: source?.fingerprint,
      targetFingerprint: target?.fingerprint,
      status,
    });
  }

  return {
    rows,
    identical: rows.filter((r) => r.status === 'identical').length,
    different: rows.filter((r) => r.status === 'different').length,
    missingInSource: rows.filter((r) => r.status === 'missing_in_source').length,
    missingInTarget: rows.filter((r) => r.status === 'missing_in_target').length,
    total: rows.length,
  };
};

/** Percentage of keys present and identical across both environments (0-100). */
export const syncScore = (summary: ComparisonSummary): number => {
  if (summary.total === 0) return 100;
  return Math.round((summary.identical / summary.total) * 100);
};
