"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { ProjectWithTasks } from "@/lib/server/services/projects";
import { DeleteProjectButton } from "./delete-project-button";
import { ProjectDetailDialog } from "./project-detail-dialog";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectStatusBadge } from "./project-status-badge";

export function ProjectCard({ project }: { project: ProjectWithTasks }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const doneTasks = project.tasks.filter((task) => task.isDone).length;

  return (
    <>
      <Card className="flex cursor-pointer flex-col gap-3 p-5" onClick={() => setDetailOpen(true)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium leading-tight">{project.name}</p>
            {project.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-0.5" onClick={(event) => event.stopPropagation()}>
            <ProjectFormDialog
              project={project}
              trigger={
                <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${project.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
            <DeleteProjectButton id={project.id} name={project.name} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ProjectStatusBadge status={project.status} />
          <Badge variant={project.priority === "HIGH" ? "warning" : "default"}>{project.priority}</Badge>
          {project.tasks.length > 0 ? (
            <Badge>
              {doneTasks}/{project.tasks.length} tasks
            </Badge>
          ) : null}
        </div>

        {project.technologies.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {project.technologies.map((tech) => (
              <Badge key={tech}>{tech}</Badge>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <ProgressBar value={project.progressPercent} />
          <span className="shrink-0 text-xs text-muted-foreground">{project.progressPercent}%</span>
        </div>
      </Card>

      <ProjectDetailDialog project={project} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}
