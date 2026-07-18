// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Invite Member Dialog
// Email + role selection form that issues an organization invitation.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { createInvitation } from '../../../services/members/member-service';
import { createAuditContext } from '../../../services/audit/audit-service';
import { useAuthStore } from '../../auth/store/authStore';
import type { OrganizationRole } from '../../../types';
import { cn } from '../../../lib/utils';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ASSIGNABLE_ROLES: { id: OrganizationRole; label: string; desc: string }[] = [
  { id: 'admin', label: 'Admin', desc: 'Full access except billing' },
  { id: 'devops', label: 'DevOps', desc: 'All environments & integrations' },
  { id: 'developer', label: 'Developer', desc: 'Read/write non-production' },
  { id: 'viewer', label: 'Viewer', desc: 'Read-only access' },
  { id: 'auditor', label: 'Auditor', desc: 'Read-only audit logs' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const InviteMemberDialog = ({ open, onOpenChange }: InviteMemberDialogProps) => {
  const { user, activeOrganization } = useAuthStore();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationRole>('developer');

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');
      const ctx = createAuditContext(
        activeOrganization.id,
        user.uid,
        user.email,
        user.name,
      );
      return createInvitation(
        {
          organizationId: activeOrganization.id,
          organizationName: activeOrganization.name,
          email,
          roleIds: [role],
          invitedBy: user.uid,
          invitedByName: user.name,
        },
        ctx,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', activeOrganization?.id] });
      toast.success(`Invitation sent to ${email}.`);
      setEmail('');
      setRole('developer');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to send invitation.'),
  });

  const submit = () => {
    if (!EMAIL_RE.test(email.trim())) {
      toast.error('Enter a valid email address.');
      return;
    }
    inviteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={16} className="text-emerald-500" /> Invite Member
          </DialogTitle>
          <DialogDescription>
            Send an email invitation to join <strong>{activeOrganization?.name}</strong>.
            The invite expires in 7 days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <div className="grid grid-cols-1 gap-2">
              {ASSIGNABLE_ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                    role === r.id
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-border hover:bg-accent/50',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      role === r.id ? 'border-emerald-500' : 'border-muted-foreground/40',
                    )}
                  >
                    {role === r.id && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">{r.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <Mail size={14} className="mr-2" />
            )}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
