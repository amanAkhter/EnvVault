// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Environment Comparison Dialog
// Fingerprint-based diff of variables between two environments (no decryption).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCompare, Loader2, Check, X, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { EmptyState } from '../../../components/ui/feedback';
import { variableRepository } from '../../../services/firestore';
import { compareEnvironments, syncScore } from '../../../services/analysis/comparison-service';
import type { Project, Environment, EnvironmentComparisonResult } from '../../../types';
import { cn } from '../../../lib/utils';

interface EnvironmentCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  sourceEnv: Environment;
  environments: Environment[];
}

const STATUS_META: Record<
  EnvironmentComparisonResult['status'],
  { label: string; className: string }
> = {
  identical: { label: 'Identical', className: 'text-emerald-500' },
  different: { label: 'Different', className: 'text-amber-500' },
  missing_in_source: { label: 'Only in target', className: 'text-blue-400' },
  missing_in_target: { label: 'Only in source', className: 'text-red-400' },
};

export const EnvironmentCompareDialog = ({
  open,
  onOpenChange,
  project,
  sourceEnv,
  environments,
}: EnvironmentCompareDialogProps) => {
  const targets = environments.filter((e) => e.id !== sourceEnv.id);
  const [targetId, setTargetId] = useState<string>(targets[0]?.id ?? '');
  const targetEnv = environments.find((e) => e.id === targetId);

  const { data: sourceVars } = useQuery({
    queryKey: ['variables', project.id, sourceEnv.id],
    queryFn: () => variableRepository.getByEnvironment(project.id, sourceEnv.id),
    enabled: open,
  });
  const { data: targetVars, isLoading } = useQuery({
    queryKey: ['variables', project.id, targetId],
    queryFn: () => variableRepository.getByEnvironment(project.id, targetId),
    enabled: open && !!targetId,
  });

  const summary = useMemo(
    () => compareEnvironments(sourceVars ?? [], targetVars ?? []),
    [sourceVars, targetVars],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare size={16} className="text-emerald-500" /> Compare Environments
          </DialogTitle>
          <DialogDescription>
            Diff uses SHA-256 fingerprints — values are never decrypted.
          </DialogDescription>
        </DialogHeader>

        {/* Source → Target selectors */}
        <div className="flex items-center gap-3 text-sm">
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1"
            style={{ color: sourceEnv.color }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sourceEnv.color }} />
            {sourceEnv.name}
          </span>
          <ArrowRight size={16} className="text-muted-foreground" />
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
          >
            {targets.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        {targets.length === 0 ? (
          <EmptyState
            icon={<GitCompare size={22} className="text-muted-foreground" />}
            title="Nothing to compare"
            description="Create a second environment to run a comparison."
          />
        ) : (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Sync', value: `${syncScore(summary)}%`, cls: 'text-foreground' },
                { label: 'Identical', value: summary.identical, cls: 'text-emerald-500' },
                { label: 'Different', value: summary.different, cls: 'text-amber-500' },
                {
                  label: 'Missing',
                  value: summary.missingInSource + summary.missingInTarget,
                  cls: 'text-red-400',
                },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-2">
                  <div className={cn('text-lg font-bold', s.cls)}>{s.value}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-muted-foreground" size={20} />
                </div>
              ) : summary.total === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No variables in either environment.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Key</th>
                      <th className="text-center font-medium px-2 py-2 w-16">Source</th>
                      <th className="text-center font-medium px-2 py-2 w-16">Target</th>
                      <th className="text-right font-medium px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((r) => {
                      const meta = STATUS_META[r.status];
                      return (
                        <tr key={r.key} className="border-t border-border/60">
                          <td className="px-3 py-1.5 font-mono text-xs truncate max-w-[220px]">
                            {r.key}
                          </td>
                          <td className="text-center">
                            {r.sourceFingerprint ? (
                              <Check size={14} className="inline text-emerald-500" />
                            ) : (
                              <X size={14} className="inline text-muted-foreground/40" />
                            )}
                          </td>
                          <td className="text-center">
                            {r.targetFingerprint ? (
                              <Check size={14} className="inline text-emerald-500" />
                            ) : (
                              <X size={14} className="inline text-muted-foreground/40" />
                            )}
                          </td>
                          <td className={cn('px-3 py-1.5 text-right text-xs font-medium', meta.className)}>
                            {meta.label}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {targetEnv && (
              <p className="text-[11px] text-muted-foreground">
                Comparing <strong>{sourceEnv.name}</strong> against <strong>{targetEnv.name}</strong>.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
