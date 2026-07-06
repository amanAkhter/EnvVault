import { Project } from "../../../types";
import dayjs from "dayjs";
import { Globe, Calendar, User, FileCode2 } from "lucide-react";
import { Github } from "../../../components/icons/Github";

export const ProjectInfo = ({ project }: { project: Project }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm">
        <div className="font-bold text-lg text-foreground">Project Details</div>
        <hr className="border-border" />
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Globe className="text-muted-foreground shrink-0" size={20} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Hosted URL</p>
              <a href={project.hostedUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm truncate block">
                {project.hostedUrl || 'Not specified'}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Github className="text-muted-foreground shrink-0" size={20} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">GitHub URL</p>
              <a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline text-sm truncate block">
                {project.githubUrl || 'Not specified'}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="text-muted-foreground shrink-0" size={20} />
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="text-sm text-foreground">{project.createdBy}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm">
        <div className="font-bold text-lg text-foreground">Statistics</div>
        <hr className="border-border" />
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="text-muted-foreground shrink-0" size={20} />
            <div>
              <p className="text-xs text-muted-foreground">Created At</p>
              <p className="text-sm text-foreground">{dayjs(project.createdAt).format('MMMM D, YYYY h:mm A')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="text-muted-foreground shrink-0" size={20} />
            <div>
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="text-sm text-foreground">{dayjs(project.updatedAt).format('MMMM D, YYYY h:mm A')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FileCode2 className="text-muted-foreground shrink-0" size={20} />
            <div>
              <p className="text-xs text-muted-foreground">Variables Count</p>
              <p className="text-sm text-foreground">
                <span className="font-medium">{project.environments.development.variables.length}</span> Development,{' '}
                <span className="font-medium">{project.environments.production.variables.length}</span> Production
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
