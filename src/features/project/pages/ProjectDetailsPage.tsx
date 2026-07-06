import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { fetchProjectById, updateProject } from '../../dashboard/api/projectsApi';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { useEffect, useState } from 'react';
import { useEnvStore } from '../../env/store/envStore';
import { Save, Search, ArrowLeft, Loader2 } from 'lucide-react';
import { EnvEditor } from '../../env/pages/EnvEditor';
import { reauthenticateGoogle } from '../../auth/api/authApi';
import { ProjectInfo } from './ProjectInfo';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../auth/store/authStore';

export const ProjectDetailsPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, activeOrganization, can } = useAuthStore();

  const [activeTab, setActiveTab] = useState<string>("development");
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', activeOrganization?.id, projectId],
    queryFn: () => fetchProjectById(projectId!, activeOrganization!.id),
    enabled: !!projectId && !!activeOrganization,
  });

  const envStore = useEnvStore();

  useEffect(() => {
    if (project) {
      envStore.init(
        project.environments.development.variables,
        project.environments.production.variables
      );
    }
  }, [project]);

  const handleSave = async () => {
    if (!project || !projectId) return;
    if (!can('projects.update') || !can('variables.update')) {
      toast.error("You do not have permission to update project variables.");
      return;
    }

    const toastId = toast.loading("Re-authenticating and saving changes...");
    try {
      setIsSaving(true);
      // Re-authenticate before saving sensitive env data
      await reauthenticateGoogle();

      await updateProject(projectId, {
        organizationId: project.organizationId || activeOrganization?.id,
        updatedAt: Date.now(),
        updatedBy: user?.uid,
        environments: {
          development: { variables: envStore.development },
          production: { variables: envStore.production },
        }
      });

      envStore.init(envStore.development, envStore.production); // reset dirty flag
      queryClient.invalidateQueries({ queryKey: ['project', activeOrganization?.id, projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', activeOrganization?.id] });
      toast.success("Changes saved successfully!", { id: toastId, duration: 3000 });
    } catch (error: any) {
      console.error("Failed to save:", error);
      toast.error(error?.message || "Authentication failed or save error. Please try again.", { id: toastId, duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center mt-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">Project unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The project does not exist in this workspace or you do not have access to it.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => navigate('/')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button size="icon" variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">Manage environment variables for this project.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="development">Development</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="info">Information</TabsTrigger>
          </TabsList>

          {activeTab !== 'info' && (
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keys or values..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={!envStore.isDirty || isSaving || !can('projects.update') || !can('variables.update')}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save size={16} className="mr-2" />}
                Save Changes
              </Button>
            </div>
          )}
        </div>
        <hr className="border-border my-4" />

        <div className="mt-4">
          <TabsContent value="development" className="mt-0 outline-none">
            <EnvEditor env="development" search={search} project={project} />
          </TabsContent>
          <TabsContent value="production" className="mt-0 outline-none">
            <EnvEditor env="production" search={search} project={project} />
          </TabsContent>
          <TabsContent value="info" className="mt-0 outline-none">
            <ProjectInfo project={project} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
