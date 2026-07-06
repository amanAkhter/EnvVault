import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "../../dashboard/api/projectsApi";
import { useAuthStore } from "../../auth/store/authStore";
import { Globe, Loader2 } from "lucide-react";
import { Github } from "../../../components/icons/Github";
import { toast } from "react-hot-toast";

const projectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  hostedUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  githubUrl: z.string().url("Must be a valid URL").or(z.literal("")),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export const CreateProjectPage = () => {
  const navigate = useNavigate();
  const { user, activeOrganization, can } = useAuthStore();
  const queryClient = useQueryClient();

  const { control, handleSubmit, formState: { errors } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      hostedUrl: "",
      githubUrl: "",
    }
  });

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', activeOrganization?.id] });
      toast.success("Project created successfully!");
      navigate(`/projects/${data.id}`);
    },
    onError: () => {
      toast.error("Failed to create project. Please try again.");
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    if (!activeOrganization) {
      toast.error("No active workspace is available.");
      return;
    }

    if (!can('projects.create')) {
      toast.error("You do not have permission to create projects.");
      return;
    }

    const now = Date.now();
    mutation.mutate({
      organizationId: activeOrganization.id,
      name: data.name,
      hostedUrl: data.hostedUrl,
      githubUrl: data.githubUrl,
      repositoryUrl: data.githubUrl,
      deploymentUrl: data.hostedUrl,
      status: 'active',
      ownerId: user?.uid,
      archived: false,
      createdBy: user?.name || 'Unknown',
      createdAt: now,
      updatedBy: user?.uid,
      updatedAt: now,
      environments: {
        development: { variables: [] },
        production: { variables: [] }
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card border border-border rounded-2xl shadow-sm">
        <div className="flex flex-col items-start px-6 pt-6 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Create New Project</h1>
          <p className="text-sm text-muted-foreground">Add a new project to manage its environment variables.</p>
        </div>
        <hr className="border-border" />
        <div className="px-6 py-6 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    {...field}
                    placeholder="My Awesome App"
                    className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
              )}
            />

            <Controller
              name="hostedUrl"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="hostedUrl">Hosted URL (Optional)</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="hostedUrl"
                      {...field}
                      placeholder="https://app.example.com"
                      className={`pl-9 ${errors.hostedUrl ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {errors.hostedUrl && <p className="text-sm text-destructive">{errors.hostedUrl.message}</p>}
                </div>
              )}
            />

            <Controller
              name="githubUrl"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="githubUrl">GitHub URL (Optional)</Label>
                  <div className="relative">
                    <Github className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="githubUrl"
                      {...field}
                      placeholder="https://github.com/user/repo"
                      className={`pl-9 ${errors.githubUrl ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {errors.githubUrl && <p className="text-sm text-destructive">{errors.githubUrl.message}</p>}
                </div>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
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
