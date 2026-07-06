// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Environment Repository
// ─────────────────────────────────────────────────────────────────────────────

import { where, orderBy } from 'firebase/firestore';
import { FirestoreRepository } from './base-repository';
import type { Environment, DEFAULT_ENVIRONMENTS } from '../../types';

class EnvironmentRepository extends FirestoreRepository<Environment> {
  constructor() {
    super('environments');
  }

  async getByProject(projectId: string): Promise<Environment[]> {
    const all = await this.getByField('projectId', projectId);
    return all.sort((a, b) => a.order - b.order);
  }

  async createDefaultEnvironments(
    projectId: string,
    organizationId: string,
    createdBy: string,
    defaults: typeof DEFAULT_ENVIRONMENTS,
  ): Promise<Environment[]> {
    const now = Date.now();
    const batch = this.createBatch();
    const environments: Environment[] = [];

    for (const def of defaults) {
      const id = `${projectId}_${def.slug}`;
      const environment: Environment = {
        id,
        projectId,
        organizationId,
        createdBy,
        createdAt: now,
        updatedAt: now,
        ...def,
      };
      this.addToBatch(batch, id, environment);
      environments.push(environment);
    }

    await batch.commit();
    return environments;
  }
}

export const environmentRepository = new EnvironmentRepository();
