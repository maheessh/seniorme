import type { ProjectStatus } from "@ccc/db";
import { PROJECT_STATUSES } from "@ccc/shared";
import { FolderKanban, Plus } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireUserId } from "@/lib/server/auth-helpers";

export const metadata: Metadata = { title: "Projects" };
import { listProjects } from "@/lib/server/services/projects";
import { ProjectCard } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectsToolbar } from "./projects-toolbar";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status && (PROJECT_STATUSES as string[]).includes(params.status)
      ? (params.status as ProjectStatus)
      : undefined;

  const userId = await requireUserId();
  const projects = await listProjects(userId, { status, search: params.search });
  const hasAny = projects.length > 0 || Boolean(params.search || status);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Track senior-year projects from idea through completion.
        </p>
      </div>

      {hasAny ? (
        <>
          <ProjectsToolbar />
          {projects.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No projects match your filters.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Add your senior-year projects to track status, tasks, and progress."
          action={
            <ProjectFormDialog
              trigger={
                <Button type="button">
                  <Plus className="h-4 w-4" /> Add your first project
                </Button>
              }
            />
          }
        />
      )}
    </div>
  );
}
