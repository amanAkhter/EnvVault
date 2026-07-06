// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Shared UI Feedback Components
// Reusable EmptyState, ErrorState, and LoadingSkeleton for consistent UX.
// ─────────────────────────────────────────────────────────────────────────────

import { cn } from '../../lib/utils';
import { Button } from './button';
import { AlertCircle, FileQuestion, Inbox, RefreshCw } from 'lucide-react';

// ── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <div className={cn(
    'flex flex-col items-center justify-center py-16 px-6 rounded-xl border border-dashed border-border bg-card/50',
    className,
  )}>
    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
      {icon || <Inbox size={24} className="text-muted-foreground" />}
    </div>
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    {description && (
      <p className="mt-1 text-sm text-muted-foreground max-w-sm text-center">{description}</p>
    )}
    {action && (
      <Button className="mt-5" onClick={action.onClick} size="sm">
        {action.label}
      </Button>
    )}
  </div>
);

// ── Error State ─────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) => (
  <div className={cn(
    'flex flex-col items-center justify-center py-16 px-6 rounded-xl border border-destructive/20 bg-destructive/5',
    className,
  )}>
    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 mb-4">
      <AlertCircle size={24} className="text-destructive" />
    </div>
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground max-w-sm text-center">{message}</p>
    {onRetry && (
      <Button variant="outline" className="mt-5" onClick={onRetry} size="sm">
        <RefreshCw size={14} className="mr-2" />
        Retry
      </Button>
    )}
  </div>
);

// ── Loading Skeleton ────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    className={cn(
      'animate-pulse rounded-md bg-muted',
      className,
    )}
  />
);

interface LoadingCardSkeletonProps {
  count?: number;
}

export const LoadingCardSkeleton = ({ count = 3 }: LoadingCardSkeletonProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
    ))}
  </div>
);

export const LoadingTableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
    ))}
  </div>
);

// ── Page Header ─────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export const PageHeader = ({ title, description, children }: PageHeaderProps) => (
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
      {description && (
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
    {children && <div className="flex items-center gap-3">{children}</div>}
  </div>
);

// ── Badge ───────────────────────────────────────────────────────────────────

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  children: React.ReactNode;
  className?: string;
}

const badgeVariants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-500',
  warning: 'bg-amber-500/10 text-amber-500',
  danger: 'bg-red-500/10 text-red-500',
  info: 'bg-blue-500/10 text-blue-500',
  outline: 'border border-border text-muted-foreground',
};

export const Badge = ({ variant = 'default', children, className }: BadgeProps) => (
  <span className={cn(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
    badgeVariants[variant],
    className,
  )}>
    {children}
  </span>
);

// ── Environment Badge ───────────────────────────────────────────────────────

interface EnvironmentBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export const EnvironmentBadge = ({ name, color, className }: EnvironmentBadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      className,
    )}
    style={{
      backgroundColor: `${color}15`,
      color: color,
    }}
  >
    <span
      className="w-1.5 h-1.5 rounded-full"
      style={{ backgroundColor: color }}
    />
    {name}
  </span>
);
