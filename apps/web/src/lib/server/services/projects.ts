import { prisma, type Prisma, type ProjectStatus } from "@ccc/db";
import type { ProjectInput } from "@ccc/shared";

export type ProjectFilters = { status?: ProjectStatus; search?: string };

const projectInclude = {
  tasks: { orderBy: { order: "asc" as const } },
} satisfies Prisma.ProjectInclude;

export type ProjectWithTasks = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export function listProjects(filters: ProjectFilters = {}) {
  return prisma.project.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    include: projectInclude,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
}

export function getProject(id: string) {
  return prisma.project.findUnique({ where: { id }, include: projectInclude });
}

function toData(input: ProjectInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    repoUrl: input.repoUrl ?? null,
    demoUrl: input.demoUrl ?? null,
    technologies: input.technologies,
    status: input.status as ProjectStatus,
    priority: input.priority,
    startDate: input.startDate ?? null,
    targetDate: input.targetDate ?? null,
    progressPercent: input.progressPercent,
    notes: input.notes ?? null,
  };
}

export function createProject(input: ProjectInput) {
  return prisma.project.create({ data: toData(input) });
}

export function updateProject(id: string, input: ProjectInput) {
  return prisma.project.update({ where: { id }, data: toData(input) });
}

export function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}

export async function addProjectTask(projectId: string, title: string, dueDate?: Date | null) {
  const count = await prisma.projectTask.count({ where: { projectId } });
  return prisma.projectTask.create({ data: { projectId, title, dueDate: dueDate ?? null, order: count } });
}

export async function toggleProjectTask(taskId: string) {
  const task = await prisma.projectTask.findUniqueOrThrow({ where: { id: taskId } });
  return prisma.projectTask.update({ where: { id: taskId }, data: { isDone: !task.isDone } });
}

export function deleteProjectTask(taskId: string) {
  return prisma.projectTask.delete({ where: { id: taskId } });
}
