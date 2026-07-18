// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – CLI Access & Encryption Keys settings section
// Shows the user's registered RSA public key (for CLI login) and their CLI
// device sessions, with a revoke action. The private key never leaves the
// user's device — this panel is read + revoke only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Terminal, ShieldOff, Copy, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../auth/store/authStore';
import { Badge } from '../../../components/ui/feedback';
import { Button } from '../../../components/ui/button';
import {
  getUserPublicKey,
  keyFingerprint,
  listCliSessions,
  revokeCliSession,
} from '../../../services/settings/cli-keys-service';

const fmtTime = (ms: number | undefined): string => {
  if (!ms) return 'never';
  return new Date(ms).toLocaleString();
};

export const CliAccessSection = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [fingerprint, setFingerprint] = useState<string>('');

  const { data: publicKey, isLoading: keyLoading } = useQuery({
    queryKey: ['userKey', user?.uid],
    queryFn: async () => {
      const key = await getUserPublicKey(user!.uid);
      if (key) setFingerprint(await keyFingerprint(key.publicKeyJwk));
      return key;
    },
    enabled: !!user,
  });

  const { data: sessions } = useQuery({
    queryKey: ['cliSessions', user?.uid],
    queryFn: () => listCliSessions(user!.uid),
    enabled: !!user,
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeCliSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliSessions', user?.uid] });
      toast.success('CLI session revoked.');
    },
    onError: (err) => toast.error((err as Error).message || 'Failed to revoke session.'),
  });

  const activeSessions = (sessions ?? []).filter((s) => s.status === 'active');

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <Terminal size={16} className="text-emerald-500" />
        <h2 className="text-sm font-semibold text-foreground">CLI Access & Encryption Keys</h2>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Public key */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound size={15} className="text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Your Public Key</p>
          </div>

          {keyLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : publicKey ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Algorithm</span>
                <span className="font-mono text-xs text-foreground">{publicKey.algorithm}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Fingerprint</span>
                <button
                  className="flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-emerald-500"
                  onClick={() => {
                    navigator.clipboard.writeText(fingerprint);
                    toast.success('Fingerprint copied.');
                  }}
                >
                  {fingerprint || '…'}
                  <Copy size={12} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Registered</span>
                <span className="text-xs text-foreground">{fmtTime(publicKey.createdAt)}</span>
              </div>
              {publicKey.rotatedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Last rotated</span>
                  <span className="text-xs text-foreground">{fmtTime(publicKey.rotatedAt)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 flex items-start gap-3">
              <Info size={15} className="text-cyan-500 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="text-foreground font-medium mb-1">No key registered yet.</p>
                Install the CLI and run <code className="font-mono text-emerald-500">envvault login</code> once. Your
                device generates an RSA keypair and registers the public key here. The private key never leaves your
                machine.
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldOff size={13} className="mt-0.5 text-amber-500" />
            <span>
              Rotating your key (<code className="font-mono">envvault login</code> on a fresh device) invalidates
              existing environment grants — an admin must re-add you afterward.
            </span>
          </div>
        </div>

        <hr className="border-border" />

        {/* CLI sessions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={15} className="text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">CLI Devices</p>
            </div>
            <Badge variant={activeSessions.length > 0 ? 'success' : 'outline'}>
              {activeSessions.length} active
            </Badge>
          </div>

          {!sessions || sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No CLI devices have signed in.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{s.deviceName}</p>
                    <p className="text-xs text-muted-foreground">
                      Last active {fmtTime(s.lastActiveAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.status === 'active' ? 'success' : 'outline'}>{s.status}</Badge>
                    {s.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeMutation.mutate(s.id)}
                        disabled={revokeMutation.isPending}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
