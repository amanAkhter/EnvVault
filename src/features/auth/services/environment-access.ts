// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Environment-level Access Control
// Beyond org-wide RBAC: some roles are restricted from production environments.
// Zero-trust default — if a role isn't explicitly cleared for a tier, deny.
// ─────────────────────────────────────────────────────────────────────────────

import type { EnvironmentType, OrganizationRole } from '../../../types';

/** Environment tiers considered "sensitive" (production-grade). */
export const SENSITIVE_ENV_TYPES: EnvironmentType[] = ['production', 'staging'];

/**
 * Roles permitted to read/reveal variables in production-grade environments.
 * Developers and viewers are intentionally excluded from production secrets
 * (see security model §Environment Isolation).
 */
const PRODUCTION_CLEARED_ROLES: OrganizationRole[] = ['owner', 'admin', 'devops'];

export const isSensitiveEnvironment = (type: EnvironmentType): boolean =>
  SENSITIVE_ENV_TYPES.includes(type);

/**
 * Whether the given roles may access (read/reveal) an environment of `type`.
 * Non-sensitive environments are open to any org member; sensitive tiers are
 * gated to production-cleared roles.
 */
export const canAccessEnvironmentType = (
  roles: OrganizationRole[] | undefined,
  type: EnvironmentType,
): boolean => {
  if (!isSensitiveEnvironment(type)) return true;
  if (!roles || roles.length === 0) return false;
  return roles.some((role) => PRODUCTION_CLEARED_ROLES.includes(role));
};

/**
 * Whether the given roles may WRITE (create/update/delete) variables in an
 * environment of `type`. Staging is readable by cleared roles but production
 * writes require owner/admin/devops just like reads — mirrors read policy.
 */
export const canWriteEnvironmentType = canAccessEnvironmentType;
