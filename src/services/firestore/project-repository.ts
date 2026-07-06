// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Project Repository
// ─────────────────────────────────────────────────────────────────────────────

import { where, orderBy } from 'firebase/firestore';
import { FirestoreRepository } from './base-repository';
import type { Project } from '../../types';

class ProjectRepository extends FirestoreRepository<Project> {
  constructor() {
    super('projects');
  }

  async getByOrganization(organizationId: string): Promise<Project[]> {
    const all = await this.getByField('organizationId', organizationId);
    return all
      .filter(p => !p.isDeleted)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getActiveByOrganization(organizationId: string): Promise<Project[]> {
    const all = await this.getByField('organizationId', organizationId);
    return all
      .filter(p => p.status === 'active' && !p.isDeleted)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async archive(id: string, userId: string): Promise<void> {
    await this.update(id, {
      status: 'archived',
      updatedBy: userId,
      updatedAt: Date.now(),
    } as Partial<Project>);
  }
}

export const projectRepository = new ProjectRepository();
