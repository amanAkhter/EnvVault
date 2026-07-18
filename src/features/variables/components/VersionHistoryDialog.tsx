// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Variable Version History Dialog
// Timeline of value changes with on-demand decryption and one-click rollback.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, RotateCcw, Eye, EyeOff, Loader2, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { EmptyState, Badge } from '../../../components/ui/feedback';
import { versionRepository } from '../../../services/firestore';
import type { Variable, VariableVersion } from '../../../types';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable: Variable | null;
  /** Decrypts a stored ciphertext/iv pair to plaintext (uses project DEK). */
  decrypt: (ciphertext: string, iv: string) => Promise<string>;
  /** Restore the `old` value from a historical entry. */
  onRollback: (version: VariableVersion) => void;
  isRollingBack?: boolean;
  canRollback?: boolean;
}

export const VersionHistoryDialog = ({
  open,
  onOpenChange,
  variable,
  decrypt,
  onRollback,
  isRollingBack,
  canRollback,
}: VersionHistoryDialogProps) => {
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());

  const { data: versions, isLoading } = useQuery({
    queryKey: ['versions', variable?.id],
    queryFn: () => versionRepository.getByVariable(variable!.id),
    enabled: open && !!variable?.id,
  });

  const reveal = async (key: string, ciphertext: string, iv: string) => {
    if (revealed.has(key)) {
      setRevealed((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    try {
      const plain = await decrypt(ciphertext, iv);
      setRevealed((prev) => new Map(prev).set(key, plain));
    } catch {
      toast.error('Failed to decrypt value.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={16} className="text-emerald-500" /> Version History
          </DialogTitle>
          <DialogDescription>
            {variable ? (
              <span className="font-mono text-foreground">{variable.key}</span>
            ) : (
              'Change timeline for this variable.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            </div>
          ) : !versions || versions.length === 0 ? (
            <EmptyState
              icon={<Clock size={22} className="text-muted-foreground" />}
              title="No history yet"
              description="Value changes will appear here once this variable is edited."
            />
          ) : (
            <ol className="relative border-l border-border ml-2 space-y-4 py-2">
              {versions.map((v) => {
                const oldKey = `${v.id}-old`;
                const newKey = `${v.id}-new`;
                return (
                  <li key={v.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">v{v.version}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {dayjs(v.timestamp).format('MMM D, YYYY HH:mm')}
                        </span>
                      </div>
                      {canRollback && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => onRollback(v)}
                          disabled={isRollingBack}
                          title="Restore this value"
                        >
                          {isRollingBack ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <RotateCcw size={12} className="mr-1" />
                          )}
                          Restore
                        </Button>
                      )}
                    </div>

                    <div className="text-[11px] text-muted-foreground mt-1">
                      by {v.userEmail}
                      {v.reason ? ` · ${v.reason}` : ''}
                    </div>

                    {/* Old / New value peek */}
                    <div className="mt-2 space-y-1">
                      {(['old', 'new'] as const).map((side) => {
                        const cipher = side === 'old' ? v.oldEncryptedValue : v.newEncryptedValue;
                        const iv = side === 'old' ? v.oldIV : v.newIV;
                        const rk = side === 'old' ? oldKey : newKey;
                        const shown = revealed.get(rk);
                        return (
                          <div key={side} className="flex items-center gap-2 text-xs">
                            <span className="w-8 shrink-0 uppercase text-[10px] font-bold text-muted-foreground">
                              {side}
                            </span>
                            <code className="flex-1 min-w-0 truncate rounded bg-muted/40 px-2 py-1 font-mono">
                              {shown ?? '••••••••••••'}
                            </code>
                            <button
                              onClick={() => reveal(rk, cipher, iv)}
                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                              title={shown ? 'Hide' : 'Reveal'}
                            >
                              {shown ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
