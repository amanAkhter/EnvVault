// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Audit Service
// Centralized audit logging for all platform actions.
// Every action is logged with actor, context, and device metadata.
// ─────────────────────────────────────────────────────────────────────────────

import { auditLogRepository } from '../firestore/audit-repository';
import { useAuthStore } from '../../features/auth/store/authStore';
import type { AuditAction, AuditLog } from '../../types';

export interface AuditContext {
  organizationId: string;
  projectId?: string;
  environmentId?: string;
  actorId: string;
  actorEmail: string;
  actorName?: string;
}

/**
 * Whether audit logging is enabled for the active organization. Defaults to
 * true so absence of the flag (legacy orgs) keeps logging on.
 */
const isAuditLoggingEnabled = (organizationId: string): boolean => {
  const org = useAuthStore.getState().activeOrganization;
  if (org && org.id === organizationId) {
    return org.security?.auditLoggingEnabled !== false;
  }
  return true;
};

/**
 * Log an action to the immutable audit trail.
 * Automatically captures IP (where available), user agent, and timestamp.
 * Skips silently when the organization has disabled audit logging.
 */
export const logAuditEvent = async (
  context: AuditContext,
  action: AuditAction,
  details: Record<string, unknown> = {},
): Promise<void> => {
  if (!isAuditLoggingEnabled(context.organizationId)) return;
  try {
    const entry: Omit<AuditLog, 'id'> = {
      organizationId: context.organizationId,
      projectId: context.projectId,
      environmentId: context.environmentId,
      action,
      actorId: context.actorId,
      actorEmail: context.actorEmail,
      actorName: context.actorName,
      details: sanitizeDetails(details),
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    };

    await auditLogRepository.create(entry);
  } catch (error) {
    // Audit logging should never break the main flow.
    // Log to console and silently continue.
    console.error('[AuditService] Failed to log audit event:', error);
  }
};

/**
 * Remove any potential secret values from audit details.
 * Keys containing "value", "secret", "password", "token", "key" are redacted.
 */
const SENSITIVE_PATTERNS = /value|secret|password|token|key|credential/i;

const sanitizeDetails = (
  details: Record<string, unknown>,
): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(details)) {
    if (SENSITIVE_PATTERNS.test(key) && typeof val === 'string') {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
};

/**
 * Create an audit context from the current auth state.
 */
export const createAuditContext = (
  organizationId: string,
  actorId: string,
  actorEmail: string,
  actorName?: string,
  projectId?: string,
  environmentId?: string,
): AuditContext => ({
  organizationId,
  projectId,
  environmentId,
  actorId,
  actorEmail,
  actorName,
});
