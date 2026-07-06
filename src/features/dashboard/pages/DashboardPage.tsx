// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Dashboard Page (Redesigned)
// Premium dashboard with metrics, recent activity, health score,
// and quick actions.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Lock,
  Users,
  Activity,
  TrendingUp,
  AlertTriangle,
  Shield,
  Plus,
  ArrowRight,
  Calendar,
  Sparkles,
} from 'lucide-react';
import dayjs from 'dayjs';
import { Button, buttonVariants } from '../../../components/ui/button';
import { Skeleton, Badge, PageHeader } from '../../../components/ui/feedback';
import { projectRepository, auditLogRepository } from '../../../services/firestore';
import { useAuthStore } from '../../auth/store/authStore';
import type { Project, AuditLog } from '../../../types';
import { cn } from '../../../lib/utils';

// ── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: string;
}

const StatCard = ({ label, value, icon, trend, color }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-xl p-5 flex items-start justify-between"
  >
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {trend && (
        <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
          <TrendingUp size={12} /> {trend}
        </p>
      )}
    </div>
    <div
      className="p-2.5 rounded-lg"
      style={{ backgroundColor: `${color}15` }}
    >
      <span style={{ color }}>{icon}</span>
    </div>
  </motion.div>
);

// ── Audit Action Labels ─────────────────────────────────────────────────────

const actionLabels: Record<string, { label: string; color: string }> = {
  'variable.created':  { label: 'Created variable',  color: '#10b981' },
  'variable.updated':  { label: 'Updated variable',  color: '#3b82f6' },
  'variable.deleted':  { label: 'Deleted variable',  color: '#ef4444' },
  'variable.revealed': { label: 'Revealed secret',   color: '#f59e0b' },
  'variable.copied':   { label: 'Copied value',      color: '#8b5cf6' },
  'project.created':   { label: 'Created project',   color: '#10b981' },
  'project.updated':   { label: 'Updated project',   color: '#3b82f6' },
  'project.deleted':   { label: 'Deleted project',   color: '#ef4444' },
  'auth.login':        { label: 'Signed in',         color: '#6366f1' },
  'auth.logout':       { label: 'Signed out',        color: '#6b7280' },
  'member.invited':    { label: 'Invited member',    color: '#ec4899' },
  'export.completed':  { label: 'Exported data',     color: '#14b8a6' },
  'import.completed':  { label: 'Imported data',     color: '#f97316' },
};

// ── Dashboard Page ──────────────────────────────────────────────────────────

export const DashboardPage = () => {
  const { user, activeOrganization, can } = useAuthStore();
  const navigate = useNavigate();

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', activeOrganization?.id],
    queryFn: () => projectRepository.getActiveByOrganization(activeOrganization!.id),
    enabled: !!activeOrganization,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-recent', activeOrganization?.id],
    queryFn: () => auditLogRepository.getByOrganization(activeOrganization!.id, 10),
    enabled: !!activeOrganization,
  });

  const recentLogs = auditData?.data ?? [];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here's what's happening in <strong>{activeOrganization?.name || 'your workspace'}</strong>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Projects"
          value={projectsLoading ? '...' : projects?.length ?? 0}
          icon={<FolderKanban size={20} />}
          color="#10b981"
        />
        <StatCard
          label="Secrets"
          value="—"
          icon={<Lock size={20} />}
          color="#3b82f6"
        />
        <StatCard
          label="Team Members"
          value="1"
          icon={<Users size={20} />}
          color="#8b5cf6"
        />
        <StatCard
          label="Security Score"
          value="A+"
          icon={<Shield size={20} />}
          color="#f59e0b"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Projects</h2>
            <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="p-2">
            {projectsLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !projects || projects.length === 0 ? (
              <div className="py-12 text-center">
                <FolderKanban size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">No projects yet</p>
                {can('projects.create') && (
                  <Button size="sm" onClick={() => navigate('/projects/new')}>
                    <Plus size={14} className="mr-2" /> Create Project
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {projects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-accent/50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <FolderKanban size={14} className="text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-emerald-500 transition-colors">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated {dayjs(project.updatedAt).fromNow?.() || dayjs(project.updatedAt).format('MMM D')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {project.framework && (
                        <Badge variant="outline" className="text-[10px]">{project.framework}</Badge>
                      )}
                      <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
            <Link to="/audit" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="p-2">
            {auditLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="py-12 text-center">
                <Activity size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentLogs.slice(0, 8).map((log) => {
                  const meta = actionLabels[log.action] || { label: log.action, color: '#6b7280' };
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground">
                          <span className="font-medium">{log.actorName || log.actorEmail}</span>{' '}
                          <span className="text-muted-foreground">{meta.label}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {dayjs(log.timestamp).format('MMM D, h:mm A')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
