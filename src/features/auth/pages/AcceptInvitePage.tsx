// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Accept Invitation Page
// Public landing for the email invite link. Loads the invitation, requires the
// recipient to be signed in with the matching email, then accepts and joins.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams, useNavigate, Navigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  LockKeyhole,
  Loader2,
  ShieldCheck,
  MailWarning,
  CheckCircle2,
  LogIn,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../../components/ui/button';
import { invitationRepository } from '../../../services/firestore';
import { acceptInvitation } from '../../../services/members/member-service';
import { loginWithGoogle } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import type { Invitation } from '../../../types';

type Blocker =
  | { kind: 'missing' }
  | { kind: 'expired' }
  | { kind: 'used'; status: Invitation['status'] }
  | { kind: 'mismatch'; invitedEmail: string }
  | null;

export const AcceptInvitePage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const invitationId = params.get('id');
  const { user, isLoading: authLoading } = useAuthStore();
  const [signingIn, setSigningIn] = useState(false);

  const { data: invitation, isLoading } = useQuery({
    queryKey: ['invitation', invitationId],
    queryFn: () => invitationRepository.getById(invitationId!),
    enabled: !!invitationId,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!invitation || !user) throw new Error('Not ready');
      return acceptInvitation(invitation, user);
    },
    onSuccess: () => {
      toast.success('Invitation accepted. Welcome aboard!');
      // Full reload so the auth listener re-fetches memberships and the new
      // organization becomes available in the session.
      window.location.href = '/';
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to accept invitation.'),
  });

  const handleGoogle = async () => {
    try {
      setSigningIn(true);
      await loginWithGoogle();
    } catch (err: any) {
      toast.error(err?.message || 'Sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  if (!invitationId) return <Navigate to="/login" replace />;

  // Determine any blocking condition.
  const blocker: Blocker = (() => {
    if (!invitation) return { kind: 'missing' };
    if (invitation.status !== 'pending') return { kind: 'used', status: invitation.status };
    if (invitation.expiresAt <= Date.now()) return { kind: 'expired' };
    if (user && invitation.email !== user.email.toLowerCase()) {
      return { kind: 'mismatch', invitedEmail: invitation.email };
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <LockKeyhole size={22} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground leading-tight">EnvVault</p>
              <p className="text-xs text-muted-foreground">Workspace invitation</p>
            </div>
          </div>

          <div className="px-6 py-7">
            {(isLoading || authLoading) ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
                <p className="text-sm text-muted-foreground">Loading invitation…</p>
              </div>
            ) : blocker ? (
              <BlockerView blocker={blocker} onGoLogin={() => navigate('/login')} />
            ) : (
              <>
                <h1 className="text-xl font-bold text-foreground text-center">
                  Join {invitation!.organizationName}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                  <strong className="text-foreground">{invitation!.invitedByName}</strong> invited{' '}
                  <strong className="text-foreground">{invitation!.email}</strong> as a{' '}
                  <span className="text-emerald-500 font-medium">{invitation!.roleIds[0]}</span>.
                </p>

                <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2.5">
                  <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                  <span>Secrets stay encrypted with AES-256-GCM. Access is role-scoped.</span>
                </div>

                <div className="mt-6">
                  {!user ? (
                    <>
                      <p className="text-xs text-muted-foreground text-center mb-3">
                        Sign in as <strong>{invitation!.email}</strong> to accept.
                      </p>
                      <Button
                        className="w-full h-11 font-semibold"
                        onClick={handleGoogle}
                        disabled={signingIn}
                      >
                        {signingIn ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <LogIn size={16} className="mr-2" />
                        )}
                        Sign in to accept
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full h-11 font-semibold"
                      onClick={() => acceptMutation.mutate()}
                      disabled={acceptMutation.isPending}
                    >
                      {acceptMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} className="mr-2" />
                      )}
                      Accept invitation
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Didn't expect this? You can safely ignore it.
        </p>
      </motion.div>
    </div>
  );
};

const BlockerView = ({
  blocker,
  onGoLogin,
}: {
  blocker: NonNullable<Blocker>;
  onGoLogin: () => void;
}) => {
  const copy: Record<NonNullable<Blocker>['kind'], { title: string; msg: string }> = {
    missing: {
      title: 'Invitation not found',
      msg: 'This invitation link is invalid or has been removed.',
    },
    expired: {
      title: 'Invitation expired',
      msg: 'This invitation is no longer valid. Ask an admin to send a new one.',
    },
    used: {
      title: 'Invitation unavailable',
      msg:
        blocker.kind === 'used' && blocker.status === 'accepted'
          ? 'This invitation has already been accepted.'
          : 'This invitation has been revoked.',
    },
    mismatch: {
      title: 'Wrong account',
      msg:
        blocker.kind === 'mismatch'
          ? `This invitation was sent to ${blocker.invitedEmail}. Sign in with that email to accept.`
          : '',
    },
  };
  const { title, msg } = copy[blocker.kind];

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="p-3 rounded-full bg-amber-500/10">
        <MailWarning size={26} className="text-amber-500" />
      </div>
      <h1 className="text-lg font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground max-w-xs">{msg}</p>
      <Button variant="outline" className="mt-2" onClick={onGoLogin}>
        Go to sign in
      </Button>
    </div>
  );
};
