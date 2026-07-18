// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Invitation Repository
// Email-based organization invitations with expiry and status tracking.
// ─────────────────────────────────────────────────────────────────────────────

import { FirestoreRepository } from './base-repository';
import type { Invitation } from '../../types';

class InvitationRepository extends FirestoreRepository<Invitation> {
  constructor() {
    super('invitations');
  }

  /** All invitations for an organization, newest first. */
  async getByOrganization(organizationId: string): Promise<Invitation[]> {
    const all = await this.getByField('organizationId', organizationId);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Pending, non-expired invitations for an organization. */
  async getPending(organizationId: string): Promise<Invitation[]> {
    const now = Date.now();
    const all = await this.getByOrganization(organizationId);
    return all.filter((i) => i.status === 'pending' && i.expiresAt > now);
  }

  /** Invitations addressed to a given email across organizations. */
  async getByEmail(email: string): Promise<Invitation[]> {
    const all = await this.getByField('email', email.toLowerCase());
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const invitationRepository = new InvitationRepository();
