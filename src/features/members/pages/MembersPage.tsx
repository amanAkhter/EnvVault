// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Members Page
// Organization member management with roles, invitations, and permissions.
// ─────────────────────────────────────────────────────────────────────────────

import { useAuthStore } from '../../auth/store/authStore';
import { Users, Mail, Shield, UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { PageHeader, EmptyState, Badge } from '../../../components/ui/feedback';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';

export const MembersPage = () => {
  const { user, activeOrganization, memberships, can } = useAuthStore();
  const canInvite = can('members.invite');

  // For now, show current memberships from auth store
  const currentMembership = memberships.find(
    (m) => m.organizationId === activeOrganization?.id,
  );

  const roleColors: Record<string, string> = {
    owner: '#f59e0b',
    admin: '#3b82f6',
    devops: '#8b5cf6',
    developer: '#10b981',
    viewer: '#6b7280',
    auditor: '#ec4899',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members"
        description="Manage who has access to your workspace and their permissions."
      >
        {canInvite && (
          <Button size="sm" disabled>
            <UserPlus size={14} className="mr-2" />
            Invite Member
          </Button>
        )}
      </PageHeader>

      {/* Current User */}
      {currentMembership && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Active Members</h3>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`} />
              <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{currentMembership.displayName}</p>
              <p className="text-xs text-muted-foreground">{currentMembership.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {currentMembership.roleIds.map((role) => (
                <Badge
                  key={role}
                  className="text-[10px]"
                  variant="outline"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full mr-1.5"
                    style={{ backgroundColor: roleColors[role] || '#6b7280' }}
                  />
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Badge>
              ))}
            </div>
            <Badge variant="success" className="text-[10px]">
              {currentMembership.status}
            </Badge>
          </div>
        </div>
      )}

      {/* Invitation Section */}
      <div className="mt-8">
        <EmptyState
          icon={<Mail size={24} className="text-muted-foreground" />}
          title="Invite your team"
          description="Add team members by email to collaborate on projects and share secrets securely."
          action={canInvite ? { label: 'Send Invitation', onClick: () => {} } : undefined}
        />
      </div>

      {/* RBAC Info */}
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
    </div>
  );
};
