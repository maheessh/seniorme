import { prisma, type GoalStatus, type Prisma } from "@ccc/db";
import type { GoalInput } from "@ccc/shared";

export type GoalFilters = { status?: GoalStatus; search?: string };

const goalInclude = {
  milestones: { orderBy: { id: "asc" as const } },
} satisfies Prisma.GoalInclude;

export type GoalWithMilestones = Prisma.GoalGetPayload<{ include: typeof goalInclude }>;

export function listGoals(filters: GoalFilters = {}) {
  return prisma.goal.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    include: goalInclude,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
}

export function getGoal(id: string) {
  return prisma.goal.findUnique({ where: { id }, include: goalInclude });
}

function toData(input: GoalInput) {
  return {
    title: input.title,
    category: input.category as Prisma.GoalUncheckedCreateInput["category"],
    targetValue: input.targetValue ?? null,
    currentValue: input.currentValue,
    deadline: input.deadline ?? null,
    priority: input.priority,
    status: input.status as GoalStatus,
    notes: input.notes ?? null,
  };
}

export function createGoal(input: GoalInput) {
  return prisma.goal.create({ data: toData(input) });
}

export function updateGoal(id: string, input: GoalInput) {
  return prisma.goal.update({ where: { id }, data: toData(input) });
}

export function deleteGoal(id: string) {
  return prisma.goal.delete({ where: { id } });
}

export async function incrementGoalProgress(id: string, delta: number): Promise<void> {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id } });
  const nextValue = Math.max(0, goal.currentValue + delta);
  const reachedTarget = goal.targetValue != null && nextValue >= goal.targetValue;
  await prisma.goal.update({
    where: { id },
    data: {
      currentValue: nextValue,
      status: reachedTarget && goal.status !== "COMPLETED" ? "COMPLETED" : goal.status,
    },
  });
}

export async function addGoalMilestone(goalId: string, title: string, dueDate?: Date | null) {
  return prisma.goalMilestone.create({ data: { goalId, title, dueDate: dueDate ?? null } });
}

export async function toggleGoalMilestone(milestoneId: string) {
  const milestone = await prisma.goalMilestone.findUniqueOrThrow({ where: { id: milestoneId } });
  return prisma.goalMilestone.update({ where: { id: milestoneId }, data: { isDone: !milestone.isDone } });
}

export function deleteGoalMilestone(milestoneId: string) {
  return prisma.goalMilestone.delete({ where: { id: milestoneId } });
}
