// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Variable Repository
// Root-level collection for scalability (supports millions of variables).
// ─────────────────────────────────────────────────────────────────────────────

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreRepository, type PaginatedResult } from './base-repository';
import type { Variable } from '../../types';

class VariableRepository extends FirestoreRepository<Variable> {
  constructor() {
    super('variables');
  }

  async getByEnvironment(
    projectId: string,
    environmentId: string,
  ): Promise<Variable[]> {
    const all = await this.getByField('environmentId', environmentId);
    return all
      .filter((v) => v.projectId === projectId && !v.isDeleted)
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  async getByEnvironmentPaginated(
    projectId: string,
    environmentId: string,
    pageSize = 50,
    startAfterDoc?: any,
  ): Promise<PaginatedResult<Variable>> {
    return this.getPaginated({
      constraints: [
        where('projectId', '==', projectId),
        where('environmentId', '==', environmentId),
        where('isDeleted', '!=', true),
      ],
      orderByField: 'key',
      orderDirection: 'asc',
      pageSize,
      startAfterDoc,
    });
  }

  async getPinnedByProject(projectId: string): Promise<Variable[]> {
    return this.getAll({
      constraints: [
        where('projectId', '==', projectId),
        where('isPinned', '==', true),
        where('isDeleted', '!=', true),
      ],
    });
  }

  async getFavoritesByProject(projectId: string): Promise<Variable[]> {
    return this.getAll({
      constraints: [
        where('projectId', '==', projectId),
        where('isFavorite', '==', true),
        where('isDeleted', '!=', true),
      ],
    });
  }

  async getExpiringVariables(
    organizationId: string,
    withinDays = 14,
  ): Promise<Variable[]> {
    const cutoff = Date.now() + withinDays * 24 * 60 * 60 * 1000;
    return this.getAll({
      constraints: [
        where('organizationId', '==', organizationId),
        where('expirationDate', '!=', null),
        where('expirationDate', '<=', cutoff),
        where('isDeleted', '!=', true),
      ],
    });
  }

  async countByProject(projectId: string): Promise<number> {
    const vars = await this.getAll({
      constraints: [
        where('projectId', '==', projectId),
        where('isDeleted', '!=', true),
      ],
    });
    return vars.length;
  }

  async bulkCreate(variables: Omit<Variable, 'id'>[]): Promise<void> {
    // Firestore batch writes are limited to 500 operations
    const BATCH_SIZE = 500;
    for (let i = 0; i < variables.length; i += BATCH_SIZE) {
      const batch = this.createBatch();
      const chunk = variables.slice(i, i + BATCH_SIZE);
      for (const variable of chunk) {
        const ref = this.newDocRef();
        const withId = { ...variable, id: ref.id } as Variable;
        this.addToBatch(batch, ref.id, withId);
      }
      await batch.commit();
    }
  }

  async bulkDelete(variableIds: string[], userId: string): Promise<void> {
    const BATCH_SIZE = 500;
    for (let i = 0; i < variableIds.length; i += BATCH_SIZE) {
      const batch = this.createBatch();
      const chunk = variableIds.slice(i, i + BATCH_SIZE);
      for (const id of chunk) {
        this.addToBatch(batch, id, {
          isDeleted: true,
          deletedAt: Date.now(),
          deletedBy: userId,
        } as Partial<Variable>);
      }
      await batch.commit();
    }
  }
}

export const variableRepository = new VariableRepository();
