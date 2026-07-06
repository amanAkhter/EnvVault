// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Create Project Page (Redesigned)
// Extended form with description, framework, language, tags.
// Creates project with default environments and an encrypted DEK.
// ─────────────────────────────────────────────────────────────────────────────

import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../auth/store/authStore';
import { projectRepository, environmentRepository } from '../../../services/firestore';
import { generateEncryptionKey, wrapDEK, getMasterKey } from '../../../services/crypto/encryption';
import { logAuditEvent, createAuditContext } from '../../../services/audit/audit-service';
import { Globe, Loader2, ArrowLeft, Code2, Tag } from 'lucide-react';
import { Github } from '../../../components/icons/Github';
import { toast } from 'react-hot-toast';
import { DEFAULT_ENVIRONMENTS } from '../../../types';
import type { Project } from '../../../types';

const projectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  repositoryUrl: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  deploymentUrl: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  language: z.string().max(50).optional(),
  framework: z.string().max(50).optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export const CreateProjectPage = () => {
  const navigate = useNavigate();
  const { user, activeOrganization, can } = useAuthStore();
  const queryClient = useQueryClient();

  const { control, handleSubmit, formState: { errors } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      repositoryUrl: '',
      deploymentUrl: '',
      language: '',
      framework: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      if (!activeOrganization || !user) throw new Error('No workspace');

      // Generate encryption key for this project
      const masterKey = await getMasterKey(user.uid);
      const dek = await generateEncryptionKey();
      const wrappedDEK = await wrapDEK(dek, masterKey);

      const now = Date.now();
      const projectData: Omit<Project, 'id'> = {
        organizationId: activeOrganization.id,
        name: data.name,
        description: data.description || undefined,
        repositoryUrl: data.repositoryUrl || undefined,
        deploymentUrl: data.deploymentUrl || undefined,
        language: data.language || undefined,
        framework: data.framework || undefined,
        status: 'active',
        ownerId: user.uid,
        encryptedDEK: wrappedDEK.ciphertext,
        dekIV: wrappedDEK.iv,
        createdBy: user.name || user.email,
        createdAt: now,
        updatedBy: user.uid,
        updatedAt: now,
      };

      const project = await projectRepository.create(projectData);

      // Create default environments
      await environmentRepository.createDefaultEnvironments(
        project.id,
        activeOrganization.id,
        user.uid,
        DEFAULT_ENVIRONMENTS,
      );

      // Audit log
      await logAuditEvent(
        createAuditContext(activeOrganization.id, user.uid, user.email, user.name, project.id),
        'project.created',
        { projectName: data.name },
      );

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects', activeOrganization?.id] });
      toast.success('Project created successfully!');
      navigate(`/projects/${project.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create project.');
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="px-6 pt-6 pb-4">
          <h1 className="text-xl font-bold text-foreground">Create New Project</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add a new project to manage its secrets and configuration.
          </p>
        </div>
        <hr className="border-border" />
        <div className="px-6 py-6">
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-5">
            {/* Project Name */}
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    {...field}
                    placeholder="My Awesome App"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
              )}
            />

            {/* Description */}
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="description">Description <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
                  <Input
                    id="description"
                    {...field}
                    placeholder="Brief description of the project"
                  />
                </div>
              )}
            />

            {/* Language & Framework */}
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="language"
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="language">Language <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
                    <div className="relative">
                      <Code2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="language" {...field} placeholder="TypeScript" className="pl-9" />
                    </div>
                  </div>
                )}
              />
              <Controller
                name="framework"
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="framework">Framework <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="framework" {...field} placeholder="Next.js" className="pl-9" />
                    </div>
                  </div>
                )}
              />
            </div>

            {/* Repository URL */}
            <Controller
              name="repositoryUrl"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="repositoryUrl">Repository URL <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
                  <div className="relative">
                    <Github className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="repositoryUrl"
                      {...field}
                      placeholder="https://github.com/user/repo"
                      className={`pl-9 ${errors.repositoryUrl ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.repositoryUrl && <p className="text-sm text-destructive">{errors.repositoryUrl.message}</p>}
                </div>
              )}
            />

            {/* Deployment URL */}
            <Controller
              name="deploymentUrl"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="deploymentUrl">Deployment URL <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="deploymentUrl"
                      {...field}
                      placeholder="https://app.example.com"
                      className={`pl-9 ${errors.deploymentUrl ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.deploymentUrl && <p className="text-sm text-destructive">{errors.deploymentUrl.message}</p>}
                </div>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
