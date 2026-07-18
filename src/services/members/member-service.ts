// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Membership & Invitation Service
// Business logic for inviting, accepting, and managing organization members.
// Repositories stay dumb; policy (role → permissions, expiry) lives here.
// ─────────────────────────────────────────────────────────────────────────────

import { invitationRepository } from '../firestore/invitation-repository';
import { memberRepository, MemberRepository } from '../firestore/member-repository';
import { getPermissionsForRoles } from '../../features/auth/services/permissions';
import { logAuditEvent, type AuditContext } from '../audit/audit-service';
import { notificationService } from '../notifications/notification-service';
import type {
  Invitation,
  OrganizationMember,
  OrganizationRole,
  User,
} from '../../types';

/** Invitations are valid for 7 days by default. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface InviteParams {
  organizationId: string;
  organizationName: string;
  email: string;
  roleIds: OrganizationRole[];
  invitedBy: string;
  invitedByName: string;
}

/**
 * Create an email invitation. Idempotent per (org, email): revokes any prior
 * pending invite for the same address before issuing a fresh one.
 */
export const createInvitation = async (
  params: InviteParams,
  auditCtx: AuditContext,
): Promise<Invitation> => {
  const email = params.email.trim().toLowerCase();
  const now = Date.now();

  // Revoke stale pending invites for the same email in this org.
  const existing = await invitationRepository.getByOrganization(params.organizationId);
  for (const inv of existing) {
    if (inv.email === email && inv.status === 'pending') {
      await invitationRepository.update(inv.id, { status: 'revoked' } as Partial<Invitation>);
    }
  }

  const invitation = await invitationRepository.create({
    organizationId: params.organizationId,
    organizationName: params.organizationName,
    email,
    roleIds: params.roleIds,
    status: 'pending',
    invitedBy: params.invitedBy,
    invitedByName: params.invitedByName,
    expiresAt: now + INVITATION_TTL_MS,
    createdAt: now,
  } as Omit<Invitation, 'id'>);

  await logAuditEvent(auditCtx, 'member.invited', {
    email,
    roleIds: params.roleIds,
    invitationId: invitation.id,
  });

  // The branded invitation email is sent server-side by the `onInvitationCreated`
  // Cloud Function (Resend). No client dispatch needed.

  return invitation;
};

/** Revoke a pending invitation. */
export const revokeInvitation = async (
  invitationId: string,
  auditCtx: AuditContext,
): Promise<void> => {
  await invitationRepository.update(invitationId, { status: 'revoked' } as Partial<Invitation>);
  await logAuditEvent(auditCtx, 'member.removed', { invitationId, reason: 'invitation_revoked' });
};

/**
 * Accept an invitation for the signed-in user. Creates/updates the membership
 * record with the invited roles and marks the invitation accepted.
 * Returns the resulting membership.
 */
export const acceptInvitation = async (
  invitation: Invitation,
  user: User,
): Promise<OrganizationMember> => {
  const now = Date.now();
  if (invitation.status !== 'pending') {
    throw new Error('This invitation is no longer valid.');
  }
  if (invitation.expiresAt <= now) {
    await invitationRepository.update(invitation.id, { status: 'expired' } as Partial<Invitation>);
    throw new Error('This invitation has expired.');
  }
  if (invitation.email !== user.email.toLowerCase()) {
    throw new Error('This invitation was issued to a different email address.');
  }

  const id = MemberRepository.memberId(invitation.organizationId, user.uid);

  const membership: OrganizationMember = {
    id,
    organizationId: invitation.organizationId,
    userId: user.uid,
    email: user.email,
    displayName: user.name,
    photoURL: user.photoURL,
    roleIds: invitation.roleIds,
    effectivePermissions: getPermissionsForRoles(invitation.roleIds),
    status: 'active',
    joinedAt: now,
    invitedBy: invitation.invitedBy,
    createdAt: now,
    updatedAt: now,
  };

  await memberRepository.upsert(id, membership);
  await invitationRepository.update(invitation.id, {
    status: 'accepted',
    acceptedAt: now,
  } as Partial<Invitation>);

  await notificationService.notify({
    organizationId: invitation.organizationId,
    userId: invitation.invitedBy,
    type: 'member_joined',
    title: 'Invitation accepted',
    message: `${user.name} joined ${invitation.organizationName}.`,
    actionUrl: '/members',
  });

  return membership;
};

/** Change a member's roles and recompute their effective permissions. */
export const updateMemberRoles = async (
  member: OrganizationMember,
  roleIds: OrganizationRole[],
  auditCtx: AuditContext,
): Promise<void> => {
  await memberRepository.update(member.id, {
    roleIds,
    effectivePermissions: getPermissionsForRoles(roleIds),
    updatedAt: Date.now(),
  } as Partial<OrganizationMember>);

  await logAuditEvent(auditCtx, 'member.role_changed', {
    targetUserId: member.userId,
    targetEmail: member.email,
    roleIds,
  });
};

/** Suspend or reactivate a member. */
export const setMemberStatus = async (
  member: OrganizationMember,
  status: OrganizationMember['status'],
  auditCtx: AuditContext,
): Promise<void> => {
  await memberRepository.update(member.id, {
    status,
    updatedAt: Date.now(),
  } as Partial<OrganizationMember>);
  await logAuditEvent(auditCtx, status === 'removed' ? 'member.removed' : 'member.role_changed', {
    targetUserId: member.userId,
    targetEmail: member.email,
    status,
  });
};

/** Soft-remove a member from the organization. */
export const removeMember = async (
  member: OrganizationMember,
  auditCtx: AuditContext,
): Promise<void> => {
  await setMemberStatus(member, 'removed', auditCtx);
};
