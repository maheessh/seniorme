import { prisma, type Prisma, type ProjectStatus } from "@ccc/db";
import type { ProjectInput } from "@ccc/shared";

export type ProjectFilters = { status?: ProjectStatus; search?: string };

const projectInclude = {
  tasks: { orderBy: { order: "asc" as const } },
} satisfies Prisma.ProjectInclude;

export type ProjectWithTasks = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export function listProjects(userId: string, filters: ProjectFilters = {}) {
  return prisma.project.findMany({
    where: {
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    include: projectInclude,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
}

export function getProject(userId: string, id: string) {
  return prisma.project.findFirst({ where: { id, userId }, include: projectInclude });
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

export function createProject(userId: string, input: ProjectInput) {
  return prisma.project.create({ data: { userId, ...toData(input) } });
}

export async function updateProject(userId: string, id: string, input: ProjectInput) {
  await prisma.project.findFirstOrThrow({ where: { id, userId } });
  return prisma.project.update({ where: { id }, data: toData(input) });
}

export async function deleteProject(userId: string, id: string) {
  await prisma.project.findFirstOrThrow({ where: { id, userId } });
  return prisma.project.delete({ where: { id } });
}

export async function addProjectTask(userId: string, projectId: string, title: string, dueDate?: Date | null) {
  await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } });
  const count = await prisma.projectTask.count({ where: { projectId } });
  return prisma.projectTask.create({ data: { projectId, title, dueDate: dueDate ?? null, order: count } });
}

async function requireOwnedTask(userId: string, taskId: string) {
  return prisma.projectTask.findFirstOrThrow({ where: { id: taskId, project: { userId } } });
}

export async function toggleProjectTask(userId: string, taskId: string) {
  const task = await requireOwnedTask(userId, taskId);
  return prisma.projectTask.update({ where: { id: taskId }, data: { isDone: !task.isDone } });
}

export async function deleteProjectTask(userId: string, taskId: string) {
  await requireOwnedTask(userId, taskId);
  return prisma.projectTask.delete({ where: { id: taskId } });
}
