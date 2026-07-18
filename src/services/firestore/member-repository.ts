// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Organization Member Repository
// Manages membership records: roles, status, and effective permissions.
// ─────────────────────────────────────────────────────────────────────────────

import { FirestoreRepository } from './base-repository';
import type { OrganizationMember } from '../../types';

export class MemberRepository extends FirestoreRepository<OrganizationMember> {
  constructor() {
    super('organizationMembers');
  }

  /** Deterministic membership id used across the app: `${orgId}_${userId}`. */
  static memberId(organizationId: string, userId: string): string {
    return `${organizationId}_${userId}`;
  }

  /** All members of an organization, active first then by name. */
  async getByOrganization(organizationId: string): Promise<OrganizationMember[]> {
    const all = await this.getByField('organizationId', organizationId);
    return all
      .filter((m) => m.status !== 'removed')
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }

  async getMembership(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null> {
    return this.getById(MemberRepository.memberId(organizationId, userId));
  }
}

export const memberRepository = new MemberRepository();
