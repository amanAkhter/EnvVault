// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Project Details Page (Redesigned)
// Multi-environment variable editor with encryption, tabs, and sidebar nav.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  Settings,
  Shield,
  GitBranch,
  Globe,
  Code2,
  Calendar,
  Lock,
  FolderKanban,
  Plus,
  Trash2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Badge,
  EnvironmentBadge,
  Skeleton,
} from '../../../components/ui/feedback';
import { projectRepository, environmentRepository } from '../../../services/firestore';
import { deleteEnvironmentFn } from '../../../services/functions';
import { useAuthStore } from '../../auth/store/authStore';
import type { Project, Environment } from '../../../types';
import { VariableEditor } from '../../variables/components/VariableEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

export const ProjectDetailsPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, activeOrganization, can } = useAuthStore();
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [isAddingEnv, setIsAddingEnv] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');

  // Fetch project
  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.getById(projectId!),
    enabled: !!projectId,
  });

  // Fetch environments
  const { data: environments, isLoading: envsLoading } = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => environmentRepository.getByProject(projectId!),
    enabled: !!projectId,
  });

  // Set active environment to first available
  useEffect(() => {
    if (environments && environments.length > 0 && !activeEnvId) {
      setActiveEnvId(environments[0].id);
    }
  }, [environments, activeEnvId]);

  const createEnvMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');
      const newEnv: Omit<Environment, 'id'> = {
        projectId: projectId!,
        organizationId: activeOrganization.id,
        name,
        color: '#10b981', // default emerald
        position: (environments?.length || 0) + 1,
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await environmentRepository.create(newEnv);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', projectId] });
      toast.success('Environment created.');
      setNewEnvName('');
      setIsAddingEnv(false);
    },
    onError: () => toast.error('Failed to create environment.'),
  });

  const deleteEnvMutation = useMutation({
    mutationFn: async (envId: string) => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');
      await deleteEnvironmentFn({
        organizationId: activeOrganization.id,
        environmentId: envId,
        projectId: projectId!,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['variables'] });
      toast.success('Environment and all its variables deleted.');
      if (activeEnvId) setActiveEnvId(null);
    },
    onError: (err) => toast.error((err as Error).message || 'Failed to delete environment.'),
  });

  const isLoading = projectLoading || envsLoading;
  const activeEnvironment = environments?.find((e) => e.id === activeEnvId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <ErrorState
        title="Project not found"
        message="This project doesn't exist or you don't have access to it."
        onRetry={() => navigate('/projects')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button size="icon" variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <Badge variant={project.status === 'active' ? 'success' : 'warning'}>
                {project.status}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {project.framework && (
                <span className="flex items-center gap-1">
                  <Code2 size={12} /> {project.framework}
                </span>
              )}
              {project.language && (
                <span className="flex items-center gap-1">
                  <Code2 size={12} /> {project.language}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={12} /> Updated {dayjs(project.updatedAt).format('MMM D, YYYY')}
              </span>
              {project.encryptedDEK && (
                <span className="flex items-center gap-1 text-emerald-500">
                  <Lock size={12} /> Encrypted
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Environment Tabs */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto relative">
          {environments?.map((env) => (
            <div key={env.id} className="relative group flex items-center">
              <button
                onClick={() => setActiveEnvId(env.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeEnvId === env.id
                    ? 'border-current text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                style={activeEnvId === env.id ? { color: env.color } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: env.color }}
                />
                {env.name}
              </button>
              {can('environments.delete') && (
                <button
                  onClick={() => {
                    if (window.confirm(`Delete environment ${env.name}?`)) {
                      deleteEnvMutation.mutate(env.id);
                    }
                  }}
                  className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity bg-background/50 rounded"
                  title="Delete Environment"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}

          {/* Add Environment Button/Input */}
          {can('environments.create') && (
            <div className="flex items-center ml-2 border-b-2 border-transparent py-1.5">
              {isAddingEnv ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value)}
                    placeholder="Env name..."
                    className="h-7 w-32 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newEnvName.trim()) {
                        createEnvMutation.mutate(newEnvName.trim());
                      } else if (e.key === 'Escape') {
                        setIsAddingEnv(false);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-emerald-500"
                    onClick={() => newEnvName.trim() && createEnvMutation.mutate(newEnvName.trim())}
                    disabled={createEnvMutation.isPending}
                  >
                    {createEnvMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => setIsAddingEnv(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingEnv(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-accent/50 hover:bg-accent rounded-md transition-colors"
                >
                  <Plus size={12} /> Add Env
                </button>
              )}
            </div>
          )}
        </div>

        {/* Variable Editor */}
        {environments && environments.length > 0 ? (
          activeEnvironment && project && (
            <VariableEditor
              project={project}
              environment={activeEnvironment}
              environments={environments}
            />
          )
        ) : (
          <EmptyState
            icon={<FolderKanban size={24} className="text-muted-foreground" />}
            title="No environments"
            description="This project doesn't have any environments configured."
          />
        )}
      </div>
    </div>
  );
};
