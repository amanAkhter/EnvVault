// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Audit Log Repository
// Append-only audit log storage. Logs are immutable.
// ─────────────────────────────────────────────────────────────────────────────

import { where, orderBy } from 'firebase/firestore';
import { FirestoreRepository, type PaginatedResult } from './base-repository';
import type { AuditLog, AuditAction } from '../../types';

class AuditLogRepository extends FirestoreRepository<AuditLog> {
  constructor() {
    super('auditLogs');
  }

  /**
   * Audit logs are append-only: no updates or deletes.
   */
  override async update(): Promise<void> {
    throw new Error('Audit logs are immutable and cannot be updated.');
  }

  override async delete(): Promise<void> {
    throw new Error('Audit logs are immutable and cannot be deleted.');
  }

  async getByOrganization(
    organizationId: string,
    pageSize = 50,
    startAfterDoc?: any,
  ): Promise<PaginatedResult<AuditLog>> {
    const all = await this.getByField('organizationId', organizationId);
    const sorted = all.sort((a, b) => b.timestamp - a.timestamp);
    // Simple mock pagination for now
    const data = sorted.slice(0, pageSize);
    return { data, hasMore: sorted.length > pageSize, lastDoc: null };
  }

  async getByProject(
    projectId: string,
    pageSize = 50,
    startAfterDoc?: any,
  ): Promise<PaginatedResult<AuditLog>> {
    const all = await this.getByField('projectId', projectId);
    const sorted = all.sort((a, b) => b.timestamp - a.timestamp);
    const data = sorted.slice(0, pageSize);
    return { data, hasMore: sorted.length > pageSize, lastDoc: null };
  }

  async getByAction(
    organizationId: string,
    action: AuditAction,
    pageSize = 50,
  ): Promise<AuditLog[]> {
    const all = await this.getByField('organizationId', organizationId);
    return all
      .filter((l) => l.action === action)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, pageSize);
  }

  async getByActor(
    organizationId: string,
    actorId: string,
    pageSize = 50,
  ): Promise<AuditLog[]> {
    const all = await this.getByField('organizationId', organizationId);
    return all
      .filter((l) => l.actorId === actorId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, pageSize);
  }
}

export const auditLogRepository = new AuditLogRepository();
