// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Projects List Page
// Displays all projects in the active organization with search, filters,
// and a premium card-based layout.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Trash2,
  Calendar,
  Globe,
  GitBranch,
  Loader2,
  FolderKanban,
  AlertCircle,
  MoreHorizontal,
  Archive,
  ExternalLink,
} from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../auth/store/authStore';
import { projectRepository } from '../../../services/firestore';
import { Button, buttonVariants } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  EmptyState,
  LoadingCardSkeleton,
  PageHeader,
  Badge,
} from '../../../components/ui/feedback';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import type { Project } from '../../../types';

export const ProjectsPage = () => {
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, activeOrganization, can } = useAuthStore();

  const canCreate = can('projects.create');
  const canDelete = can('projects.delete');

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects', activeOrganization?.id],
    queryFn: () => projectRepository.getActiveByOrganization(activeOrganization!.id),
    enabled: !!activeOrganization,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectRepository.softDelete(id, user!.uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', activeOrganization?.id] });
      toast.success('Project deleted successfully.');
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error('Failed to delete project.');
    },
  });

  const filtered = (projects ?? []).filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.tags?.some((t) => t.toLowerCase().includes(q)) ||
      p.framework?.toLowerCase().includes(q) ||
      p.language?.toLowerCase().includes(q)
    );
  });

  const getFrameworkColor = (framework?: string): string => {
    const colors: Record<string, string> = {
      'next.js': '#000000',
      'react': '#61dafb',
      'vue': '#42b883',
      'angular': '#dd0031',
      'svelte': '#ff3e00',
      'express': '#000000',
      'nestjs': '#e0234e',
      'django': '#092e20',
      'flask': '#000000',
      'laravel': '#ff2d20',
      'spring': '#6db33f',
    };
    return colors[framework?.toLowerCase() ?? ''] ?? '#6b7280';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`${filtered.length} project${filtered.length !== 1 ? 's' : ''} in ${activeOrganization?.name || 'workspace'}`}
      >
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        {canCreate && (
          <Link to="/projects/new" className={buttonVariants({ size: 'sm' })}>
            <Plus size={16} className="mr-2" />
            New Project
          </Link>
        )}
      </PageHeader>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Delete "{deleteConfirm.name}"?</h3>
                  <p className="text-sm text-muted-foreground">
                    This will archive the project and all its variables.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {isLoading ? (
        <LoadingCardSkeleton count={6} />
      ) : error ? (
        <div className="text-center py-16 text-destructive">
          Failed to load projects. Please try again.
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={24} className="text-muted-foreground" />}
          title={search ? 'No matching projects' : 'No projects yet'}
          description={
            search
              ? `No projects match "${search}". Try a different search.`
              : 'Create your first project to start managing environment variables.'
          }
          action={
            canCreate && !search
              ? { label: 'Create Project', onClick: () => navigate('/projects/new') }
              : undefined
          }
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {filtered.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link
                to={`/projects/${project.id}`}
                className="block group"
              >
                <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-emerald-500/40 transition-all duration-200 shadow-sm hover:shadow-md">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground group-hover:text-emerald-500 transition-colors truncate">
                        {project.name}
                      </p>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="shrink-0 p-1 rounded-md hover:bg-accent text-muted-foreground"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreHorizontal size={16} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.preventDefault();
                          navigate(`/projects/${project.id}`);
                        }}>
                          <ExternalLink size={14} className="mr-2" />
                          Open
                        </DropdownMenuItem>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                setDeleteConfirm({ id: project.id, name: project.name });
                              }}
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {project.framework && (
                      <Badge variant="outline" className="text-[10px]">
                        {project.framework}
                      </Badge>
                    )}
                    {project.language && (
                      <Badge variant="outline" className="text-[10px]">
                        {project.language}
                      </Badge>
                    )}
                    {(project.tags ?? []).slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="default" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {dayjs(project.updatedAt).format('MMM D, YYYY')}
                    </span>
                    <Badge variant="success" className="text-[10px]">
                      {project.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
