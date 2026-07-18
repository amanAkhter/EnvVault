// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Server-authored audit logging
// Centralizes append-only audit writes so callable functions record a tamper-
// proof trail with request IP + user agent captured server-side.
// ─────────────────────────────────────────────────────────────────────────────

import type { CallableRequest } from 'firebase-functions/v2/https';
import { db } from '../config';

export interface AuditInput {
  organizationId: string;
  projectId?: string | null;
  environmentId?: string | null;
  action: string;
  actorId: string;
  actorEmail: string;
  details?: Record<string, unknown>;
}

export async function writeAudit(
  input: AuditInput,
  request?: CallableRequest,
): Promise<void> {
  await db.collection('auditLogs').add({
    organizationId: input.organizationId,
    projectId: input.projectId ?? null,
    environmentId: input.environmentId ?? null,
    action: input.action,
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    details: { ...(input.details ?? {}), source: 'cli' },
    ip: request?.rawRequest.ip ?? null,
    userAgent: request?.rawRequest.headers['user-agent'] ?? null,
    timestamp: Date.now(),
  });
}
