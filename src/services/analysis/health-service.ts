// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Configuration Health Score
// Scores an environment's variables on hygiene & security, from metadata only.
// Never decrypts values; duplicate detection uses fingerprints.
// ─────────────────────────────────────────────────────────────────────────────

import type { Variable, HealthCheckResult, HealthIssue } from '../../types';

// ── Scoring weights (points deducted per issue occurrence) ───────────────────

const WEIGHTS: Record<HealthIssue['severity'], number> = {
  critical: 15,
  warning: 6,
  info: 2,
};

/** Valid POSIX-style environment variable key: A-Z, 0-9, underscore; no leading digit. */
const VALID_KEY = /^[A-Z_][A-Z0-9_]*$/;

/**
 * Compute a 0-100 configuration health score plus a list of issues.
 * Pure function over variable metadata — safe to run client-side.
 */
export const computeHealth = (variables: Variable[]): HealthCheckResult => {
  const issues: HealthIssue[] = [];
  const now = Date.now();

  // Duplicate values across keys (same secret reused) — fingerprint collision.
  const byFingerprint = new Map<string, Variable[]>();
  for (const v of variables) {
    const list = byFingerprint.get(v.fingerprint) ?? [];
    list.push(v);
    byFingerprint.set(v.fingerprint, list);
  }

  for (const v of variables) {
    // Invalid key naming
    if (!VALID_KEY.test(v.key)) {
      issues.push({
        severity: 'warning',
        type: 'invalid_key',
        message: `Key "${v.key}" is not a valid environment variable name.`,
        variableKey: v.key,
        environmentId: v.environmentId,
      });
    }

    // Missing description
    if (!v.description || v.description.trim() === '') {
      issues.push({
        severity: 'info',
        type: 'no_description',
        message: `"${v.key}" has no description.`,
        variableKey: v.key,
        environmentId: v.environmentId,
      });
    }

    // Expired secret
    if (v.expirationDate != null && v.expirationDate <= now) {
      issues.push({
        severity: 'critical',
        type: 'expired',
        message: `"${v.key}" expired on ${new Date(v.expirationDate).toLocaleDateString()}.`,
        variableKey: v.key,
        environmentId: v.environmentId,
      });
    }
  }

  // Report each duplicate group once
  for (const [, group] of byFingerprint) {
    if (group.length > 1) {
      const keys = group.map((g) => g.key).join(', ');
      issues.push({
        severity: 'warning',
        type: 'duplicate',
        message: `Same value shared across: ${keys}.`,
        environmentId: group[0].environmentId,
      });
    }
  }

  // Score: start at 100, deduct weighted, floor at 0.
  const deduction = issues.reduce((sum, i) => sum + WEIGHTS[i.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - deduction));

  return { score, issues, lastCheckedAt: now };
};

/** Map a numeric score to a qualitative grade + tailwind color token. */
export const healthGrade = (
  score: number,
): { label: string; color: string } => {
  if (score >= 90) return { label: 'Excellent', color: 'text-emerald-500' };
  if (score >= 70) return { label: 'Good', color: 'text-lime-500' };
  if (score >= 50) return { label: 'Fair', color: 'text-amber-500' };
  if (score >= 30) return { label: 'Poor', color: 'text-orange-500' };
  return { label: 'Critical', color: 'text-red-500' };
};
