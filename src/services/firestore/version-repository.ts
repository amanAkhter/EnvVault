// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Version Repository (Variable History)
// ─────────────────────────────────────────────────────────────────────────────

import { where, orderBy } from 'firebase/firestore';
import { FirestoreRepository } from './base-repository';
import type { VariableVersion } from '../../types';

class VersionRepository extends FirestoreRepository<VariableVersion> {
  constructor() {
    super('versions');
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
