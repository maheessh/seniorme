"use server";

import { projectInputSchema } from "@ccc/shared";
import { revalidatePath } from "next/cache";
import {
  addProjectTask,
  createProject,
  deleteProject,
  deleteProjectTask,
  toggleProjectTask,
  updateProject,
} from "@/lib/server/services/projects";

export type ProjectFormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true } | undefined;

function parseProjectForm(formData: FormData) {
  return projectInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    repoUrl: formData.get("repoUrl"),
    demoUrl: formData.get("demoUrl"),
    technologies: formData.get("technologies"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    startDate: formData.get("startDate"),
    targetDate: formData.get("targetDate"),
    progressPercent: formData.get("progressPercent"),
    notes: formData.get("notes"),
  });
}

export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parseProjectForm(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  await createProject(parsed.data);
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true };
}

export async function updateProjectAction(
  id: string,
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parseProjectForm(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  await updateProject(id, parsed.data);
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProjectAction(id: string): Promise<void> {
  await deleteProject(id);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function addProjectTaskAction(projectId: string, title: string): Promise<void> {
  if (!title.trim()) return;
  await addProjectTask(projectId, title.trim());
  revalidatePath("/projects");
}

export async function toggleProjectTaskAction(taskId: string): Promise<void> {
  await toggleProjectTask(taskId);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function deleteProjectTaskAction(taskId: string): Promise<void> {
  await deleteProjectTask(taskId);
  revalidatePath("/projects");
}
