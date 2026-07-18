// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Members Page
// Live organization member management: roles, invitations, removal (RBAC-gated).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Shield, UserPlus, MoreHorizontal, Trash2, Clock, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../auth/store/authStore';
import { Button } from '../../../components/ui/button';
import { PageHeader, EmptyState, Badge, LoadingTableSkeleton } from '../../../components/ui/feedback';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { memberRepository, invitationRepository } from '../../../services/firestore';
import {
  updateMemberRoles,
  removeMember,
  revokeInvitation,
} from '../../../services/members/member-service';
import { createAuditContext } from '../../../services/audit/audit-service';
import type { OrganizationMember, OrganizationRole } from '../../../types';
import { InviteMemberDialog } from '../components/InviteMemberDialog';

const ROLE_COLORS: Record<string, string> = {
  owner: '#f59e0b',
  admin: '#3b82f6',
  devops: '#8b5cf6',
  developer: '#10b981',
  viewer: '#6b7280',
  auditor: '#ec4899',
};

const ASSIGNABLE_ROLES: OrganizationRole[] = ['admin', 'devops', 'developer', 'viewer', 'auditor'];

export const MembersPage = () => {
  const { user, activeOrganization, can } = useAuthStore();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const canInvite = can('members.invite');
  const canUpdate = can('members.update');
  const canRemove = can('members.remove');
  const orgId = activeOrganization?.id;

  const auditCtx = () =>
    createAuditContext(orgId!, user!.uid, user!.email, user!.name);

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => memberRepository.getByOrganization(orgId!),
    enabled: !!orgId,
  });

  const { data: invitations } = useQuery({
    queryKey: ['invitations', orgId],
    queryFn: () => invitationRepository.getPending(orgId!),
    enabled: !!orgId && canInvite,
  });

  const roleMutation = useMutation({
    mutationFn: ({ member, roleIds }: { member: OrganizationMember; roleIds: OrganizationRole[] }) =>
      updateMemberRoles(member, roleIds, auditCtx()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', orgId] });
      toast.success('Role updated.');
    },
    onError: () => toast.error('Failed to update role.'),
  });

  const removeMutation = useMutation({
    mutationFn: (member: OrganizationMember) => removeMember(member, auditCtx()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', orgId] });
      toast.success('Member removed.');
    },
    onError: () => toast.error('Failed to remove member.'),
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId, auditCtx()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', orgId] });
      toast.success('Invitation revoked.');
    },
    onError: () => toast.error('Failed to revoke invitation.'),
  });

  const isOwner = (m: OrganizationMember) => m.roleIds.includes('owner');
  const isSelf = (m: OrganizationMember) => m.userId === user?.uid;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members"
        description="Manage who has access to your workspace and their permissions."
      >
        {canInvite && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} className="mr-2" />
            Invite Member
          </Button>
        )}
      </PageHeader>

      {/* Active members */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Active Members {members ? `(${members.length})` : ''}
        </h3>

        {isLoading ? (
          <LoadingTableSkeleton rows={3} />
        ) : !members || members.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={22} className="text-muted-foreground" />}
            title="No members yet"
            description="Invite teammates to collaborate on projects and share secrets securely."
            action={canInvite ? { label: 'Invite Member', onClick: () => setInviteOpen(true) } : undefined}
          />
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={member.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${member.displayName}`}
                  />
                  <AvatarFallback>{member.displayName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {member.displayName}
                    {isSelf(member) && <span className="text-muted-foreground"> (you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {member.roleIds.map((role) => (
                    <Badge key={role} variant="outline" className="text-[10px]">
                      <span
                        className="w-1.5 h-1.5 rounded-full mr-1.5"
                        style={{ backgroundColor: ROLE_COLORS[role] || '#6b7280' }}
                      />
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Badge>
                  ))}
                </div>
                <Badge variant={member.status === 'active' ? 'success' : 'warning'} className="text-[10px]">
                  {member.status}
                </Badge>

                {/* Row actions — owners and self are protected */}
                {(canUpdate || canRemove) && !isOwner(member) && !isSelf(member) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                      <MoreHorizontal size={16} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {canUpdate && (
                        <>
                          <DropdownMenuLabel>Change role</DropdownMenuLabel>
                          {ASSIGNABLE_ROLES.map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() =>
                                roleMutation.mutate({ member, roleIds: [role] })
                              }
                              disabled={member.roleIds.length === 1 && member.roleIds[0] === role}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full mr-2"
                                style={{ backgroundColor: ROLE_COLORS[role] }}
                              />
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                      {canRemove && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (window.confirm(`Remove ${member.displayName} from the workspace?`)) {
                                removeMutation.mutate(member);
                              }
                            }}
                          >
                            <Trash2 size={14} className="mr-2" />
                            Remove member
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="w-[30px]" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {canInvite && invitations && invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Pending Invitations ({invitations.length})
          </h3>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="bg-card border border-dashed border-border rounded-xl p-4 flex items-center gap-4"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  <Mail size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={11} />
                    Invited by {inv.invitedByName} · expires{' '}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {inv.roleIds.map((role) => (
                  <Badge key={role} variant="outline" className="text-[10px]">
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Badge>
                ))}
                <button
                  onClick={() => revokeMutation.mutate(inv.id)}
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Revoke invitation"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RBAC reference */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield size={16} className="text-emerald-500" />
          Role-Based Access Control
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { role: 'Owner', desc: 'Full access including billing and member management' },
            { role: 'Admin', desc: 'Full access except billing management' },
            { role: 'DevOps', desc: 'All environments, integrations, imports/exports' },
            { role: 'Developer', desc: 'Read/write non-production variables' },
            { role: 'Viewer', desc: 'Read-only access to variables' },
            { role: 'Auditor', desc: 'Read-only access to audit logs' },
          ].map(({ role, desc }) => (
            <div key={role} className="border border-border rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">{role}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
};
