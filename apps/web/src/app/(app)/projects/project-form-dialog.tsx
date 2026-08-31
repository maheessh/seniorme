"use client";

import { PROJECT_STATUS_LABEL, PROJECT_STATUSES } from "@ccc/shared";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectWithTasks } from "@/lib/server/services/projects";
import { createProjectAction, updateProjectAction, type ProjectFormState } from "./actions";

function toInputDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function ProjectFormDialog({ project, trigger }: { project?: ProjectWithTasks; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const action = project ? updateProjectAction.bind(null, project.id) : createProjectAction;
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(action, undefined);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setOpen(false);
  }

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "Add project"}</DialogTitle>
          <DialogDescription>
            {project ? "Update this project's details." : "Track a senior-year project from idea to done."}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={project?.name} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={project?.description ?? ""} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repoUrl">Repo URL</Label>
              <Input id="repoUrl" name="repoUrl" placeholder="https://github.com/..." defaultValue={project?.repoUrl ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="demoUrl">Demo URL</Label>
              <Input id="demoUrl" name="demoUrl" placeholder="https://..." defaultValue={project?.demoUrl ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="technologies">Technologies</Label>
            <Input
              id="technologies"
              name="technologies"
              placeholder="Next.js, TypeScript, Postgres"
              defaultValue={project?.technologies.join(", ")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={project?.status ?? "IDEA"}>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABEL[status]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" defaultValue={project?.priority ?? "MEDIUM"}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={toInputDate(project?.startDate)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="targetDate">Target date</Label>
              <Input id="targetDate" name="targetDate" type="date" defaultValue={toInputDate(project?.targetDate)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="progressPercent">Progress ({project?.progressPercent ?? 0}%)</Label>
            <input
              id="progressPercent"
              name="progressPercent"
              type="range"
              min={0}
              max={100}
              defaultValue={project?.progressPercent ?? 0}
              className="w-full accent-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={project?.notes ?? ""} />
          </div>

          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <Button type="submit" size="lg" disabled={pending} className="mt-1">
            {pending ? "Saving…" : project ? "Save changes" : "Add project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
