import { prisma, type GoalStatus, type Prisma } from "@ccc/db";
import type { GoalInput } from "@ccc/shared";

export type GoalFilters = { status?: GoalStatus; search?: string };

const goalInclude = {
  milestones: { orderBy: { id: "asc" as const } },
} satisfies Prisma.GoalInclude;

export type GoalWithMilestones = Prisma.GoalGetPayload<{ include: typeof goalInclude }>;

export function listGoals(userId: string, filters: GoalFilters = {}) {
  return prisma.goal.findMany({
    where: {
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    include: goalInclude,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
}

export function getGoal(userId: string, id: string) {
  return prisma.goal.findFirst({ where: { id, userId }, include: goalInclude });
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

export function createGoal(userId: string, input: GoalInput) {
  return prisma.goal.create({ data: { userId, ...toData(input) } });
}

export async function updateGoal(userId: string, id: string, input: GoalInput) {
  await prisma.goal.findFirstOrThrow({ where: { id, userId } });
  return prisma.goal.update({ where: { id }, data: toData(input) });
}

export async function deleteGoal(userId: string, id: string) {
  await prisma.goal.findFirstOrThrow({ where: { id, userId } });
  return prisma.goal.delete({ where: { id } });
}

export async function incrementGoalProgress(userId: string, id: string, delta: number): Promise<void> {
  const goal = await prisma.goal.findFirstOrThrow({ where: { id, userId } });
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

export async function addGoalMilestone(userId: string, goalId: string, title: string, dueDate?: Date | null) {
  await prisma.goal.findFirstOrThrow({ where: { id: goalId, userId } });
  return prisma.goalMilestone.create({ data: { goalId, title, dueDate: dueDate ?? null } });
}

async function requireOwnedMilestone(userId: string, milestoneId: string) {
  return prisma.goalMilestone.findFirstOrThrow({
    where: { id: milestoneId, goal: { userId } },
  });
}

export async function toggleGoalMilestone(userId: string, milestoneId: string) {
  const milestone = await requireOwnedMilestone(userId, milestoneId);
  return prisma.goalMilestone.update({ where: { id: milestoneId }, data: { isDone: !milestone.isDone } });
}

export async function deleteGoalMilestone(userId: string, milestoneId: string) {
  await requireOwnedMilestone(userId, milestoneId);
  return prisma.goalMilestone.delete({ where: { id: milestoneId } });
}
