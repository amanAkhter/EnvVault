// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Audit Logs Page
// Immutable audit trail viewer with filtering and pagination.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ScrollText,
  Search,
  Filter,
  User,
  Calendar,
  Globe,
  Monitor,
  Shield,
} from 'lucide-react';
import dayjs from 'dayjs';
import { Input } from '../../../components/ui/input';
import {
  EmptyState,
  LoadingTableSkeleton,
  PageHeader,
  Badge,
} from '../../../components/ui/feedback';
import { auditLogRepository } from '../../../services/firestore';
import { useAuthStore } from '../../auth/store/authStore';
import type { AuditLog } from '../../../types';

const actionColors: Record<string, string> = {
  'variable.created':  '#10b981',
  'variable.updated':  '#3b82f6',
  'variable.deleted':  '#ef4444',
  'variable.revealed': '#f59e0b',
  'variable.copied':   '#8b5cf6',
  'project.created':   '#10b981',
  'project.updated':   '#3b82f6',
  'project.deleted':   '#ef4444',
  'auth.login':        '#6366f1',
  'auth.logout':       '#6b7280',
  'member.invited':    '#ec4899',
  'export.completed':  '#14b8a6',
  'import.completed':  '#f97316',
};

const formatAction = (action: string): string =>
  action
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' → ');

export const AuditPage = () => {
  const [search, setSearch] = useState('');
  const { activeOrganization } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', activeOrganization?.id],
    queryFn: () => auditLogRepository.getByOrganization(activeOrganization!.id, 100),
    enabled: !!activeOrganization,
  });

  const logs = data?.data ?? [];
  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.actorEmail.toLowerCase().includes(q) ||
      log.actorName?.toLowerCase().includes(q) ||
      JSON.stringify(log.details).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Immutable record of all actions in your workspace."
      >
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
      </PageHeader>

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
        <Shield size={14} className="text-emerald-500 shrink-0" />
        <span>Audit logs are <strong>immutable</strong> and cannot be edited or deleted.</span>
      </div>

      {isLoading ? (
        <LoadingTableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={24} className="text-muted-foreground" />}
          title={search ? 'No matching logs' : 'No audit logs yet'}
          description={search ? 'Try a different search term.' : 'Actions will appear here as your team uses EnvVault.'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.02 }}
              className="flex items-start gap-4 bg-card border border-border rounded-lg p-4 hover:border-border/80 transition-colors"
            >
              {/* Action Dot */}
              <div
                className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: actionColors[log.action] || '#6b7280' }}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {log.actorName || log.actorEmail}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {formatAction(log.action)}
                  </Badge>
                </div>

                {/* Details */}
                {Object.keys(log.details).length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {Object.entries(log.details).map(([key, val]) => (
                      <span key={key} className="mr-3">
                        {key}: <strong>{String(val)}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar size={10} />
                    {dayjs(log.timestamp).format('MMM D, YYYY h:mm:ss A')}
                  </span>
                  {log.userAgent && (
                    <span className="flex items-center gap-1 truncate max-w-48">
                      <Monitor size={10} />
                      {log.userAgent.split(' ').slice(0, 3).join(' ')}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
