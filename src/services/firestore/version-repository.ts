// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Version Repository (Variable History)
// ─────────────────────────────────────────────────────────────────────────────

import { where, orderBy } from 'firebase/firestore';
import { FirestoreRepository } from './base-repository';
import type { Variable, VariableVersion } from '../../types';

class VersionRepository extends FirestoreRepository<VariableVersion> {
  constructor() {
    super('versions');
  }

  /**
   * Persist an immutable history entry capturing a value change.
   * `previous` is the variable state before the write; `next` holds the
   * new encrypted value/iv/fingerprint that replaced it.
   */
  async recordChange(
    previous: Variable,
    next: { encryptedValue: string; iv: string; fingerprint: string; version: number },
    actor: { userId: string; userEmail: string },
    reason?: string,
  ): Promise<VariableVersion> {
    const entry: Omit<VariableVersion, 'id'> = {
      variableId: previous.id,
      projectId: previous.projectId,
      environmentId: previous.environmentId,
      organizationId: previous.organizationId,
      version: next.version,
      oldEncryptedValue: previous.encryptedValue,
      oldIV: previous.iv,
      oldFingerprint: previous.fingerprint,
      newEncryptedValue: next.encryptedValue,
      newIV: next.iv,
      newFingerprint: next.fingerprint,
      reason: reason ?? '',
      userId: actor.userId,
      userEmail: actor.userEmail,
      timestamp: Date.now(),
    };
    return this.create(entry);
  }

  async getByVariable(variableId: string): Promise<VariableVersion[]> {
    const all = await this.getByField('variableId', variableId);
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getLatestVersion(variableId: string): Promise<VariableVersion | null> {
    const all = await this.getByField('variableId', variableId);
    if (all.length === 0) return null;
    return all.sort((a, b) => b.version - a.version)[0];
  }

  async getByProject(projectId: string, pageSize = 50): Promise<VariableVersion[]> {
    const all = await this.getByField('projectId', projectId);
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, pageSize);
  }
}

export const versionRepository = new VersionRepository();
