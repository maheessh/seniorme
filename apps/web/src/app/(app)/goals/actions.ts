"use server";

import { goalInputSchema } from "@ccc/shared";
import { revalidatePath } from "next/cache";
import {
  addGoalMilestone,
  createGoal,
  deleteGoal,
  deleteGoalMilestone,
  incrementGoalProgress,
  toggleGoalMilestone,
  updateGoal,
} from "@/lib/server/services/goals";

export type GoalFormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true } | undefined;

function parseGoalForm(formData: FormData) {
  return goalInputSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    targetValue: formData.get("targetValue"),
    currentValue: formData.get("currentValue"),
    deadline: formData.get("deadline"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

export async function createGoalAction(_prevState: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const parsed = parseGoalForm(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  await createGoal(parsed.data);
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}

export async function updateGoalAction(
  id: string,
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const parsed = parseGoalForm(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  await updateGoal(id, parsed.data);
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteGoalAction(id: string): Promise<void> {
  await deleteGoal(id);
  revalidatePath("/goals");
  revalidatePath("/");
}

export async function incrementGoalAction(id: string, delta: number): Promise<void> {
  await incrementGoalProgress(id, delta);
  revalidatePath("/goals");
  revalidatePath("/");
}

export async function addGoalMilestoneAction(goalId: string, title: string): Promise<void> {
  if (!title.trim()) return;
  await addGoalMilestone(goalId, title.trim());
  revalidatePath("/goals");
}

export async function toggleGoalMilestoneAction(milestoneId: string): Promise<void> {
  await toggleGoalMilestone(milestoneId);
  revalidatePath("/goals");
}

export async function deleteGoalMilestoneAction(milestoneId: string): Promise<void> {
  await deleteGoalMilestone(milestoneId);
  revalidatePath("/goals");
}
