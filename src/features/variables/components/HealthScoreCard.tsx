// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Configuration Health Score Card
// Collapsible panel showing an environment's config hygiene score + issues.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import {
  ShieldCheck,
  ChevronDown,
  AlertTriangle,
  AlertOctagon,
  Info,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { computeHealth, healthGrade } from '../../../services/analysis/health-service';
import type { Variable, HealthIssue } from '../../../types';
import { cn } from '../../../lib/utils';

const SEVERITY_ICON: Record<HealthIssue['severity'], React.ReactNode> = {
  critical: <AlertOctagon size={13} className="text-red-500 shrink-0" />,
  warning: <AlertTriangle size={13} className="text-amber-500 shrink-0" />,
  info: <Info size={13} className="text-blue-400 shrink-0" />,
};

interface HealthScoreCardProps {
  variables: Variable[];
}

export const HealthScoreCard = ({ variables }: HealthScoreCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo(() => computeHealth(variables), [variables]);
  const grade = healthGrade(result.score);

  if (variables.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <ShieldCheck size={16} className={grade.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Config Health</span>
            <span className={cn('text-sm font-bold', grade.color)}>
              {result.score}
              <span className="text-xs font-normal text-muted-foreground">/100</span>
            </span>
            <span className={cn('text-xs', grade.color)}>{grade.label}</span>
          </div>
          {/* Score bar */}
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', {
                'bg-emerald-500': result.score >= 70,
                'bg-amber-500': result.score >= 50 && result.score < 70,
                'bg-red-500': result.score < 50,
              })}
              style={{ width: `${result.score}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''}
        </span>
        <ChevronDown
          size={16}
          className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-3 py-2 space-y-1.5 max-h-56 overflow-y-auto">
              {result.issues.length === 0 ? (
                <p className="text-xs text-emerald-500 py-1">
                  No issues found — configuration looks healthy.
                </p>
              ) : (
                result.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    {SEVERITY_ICON[issue.severity]}
                    <span>{issue.message}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
