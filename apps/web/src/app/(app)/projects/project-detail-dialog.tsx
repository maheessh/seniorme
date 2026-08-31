"use client";

import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { ProjectWithTasks } from "@/lib/server/services/projects";
import { addProjectTaskAction, deleteProjectTaskAction, toggleProjectTaskAction } from "./actions";
import { ProjectStatusBadge } from "./project-status-badge";

export function ProjectDetailDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectWithTasks;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>{project.name}</DialogTitle>
              {project.description ? (
                <DialogDescription className="mt-1">{project.description}</DialogDescription>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <ProjectStatusBadge status={project.status} />
            {project.repoUrl ? (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Repo <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {project.demoUrl ? (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Demo <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <ProgressBar value={project.progressPercent} />
            <span className="shrink-0 text-xs text-muted-foreground">{project.progressPercent}%</span>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Tasks</p>
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
              {project.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                project.tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <input
                      type="checkbox"
                      checked={task.isDone}
                      onChange={() => startTransition(() => void toggleProjectTaskAction(task.id))}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className={`flex-1 text-sm ${task.isDone ? "text-muted-foreground line-through" : ""}`}>
                      {task.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void deleteProjectTaskAction(task.id))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete task ${task.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!taskTitle.trim()) return;
                const title = taskTitle;
                setTaskTitle("");
                startTransition(() => void addProjectTaskAction(project.id, title));
              }}
              className="flex gap-2"
            >
              <Input
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Add a task…"
                className="flex-1"
              />
              <Button type="submit" size="icon" aria-label="Add task">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>

          {project.notes ? (
            <div>
              <p className="text-sm font-medium">Notes</p>
              <p className="text-sm text-muted-foreground">{project.notes}</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
