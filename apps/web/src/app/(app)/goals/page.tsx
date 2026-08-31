import type { GoalStatus } from "@ccc/db";
import { GOAL_STATUSES } from "@ccc/shared";
import { Plus, Target } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { listGoals } from "@/lib/server/services/goals";
import { GoalCard } from "./goal-card";
import { GoalFormDialog } from "./goal-form-dialog";
import { GoalsToolbar } from "./goals-toolbar";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status && (GOAL_STATUSES as string[]).includes(params.status) ? (params.status as GoalStatus) : undefined;

  const goals = await listGoals({ status, search: params.search });
  const hasAny = goals.length > 0 || Boolean(params.search || status);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl">Goals</h1>
        <p className="text-sm text-muted-foreground">
          Set targets — applications sent, problems solved, resume polish — and track progress.
        </p>
      </div>

      {hasAny ? (
        <>
          <GoalsToolbar />
          {goals.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No goals match your filters.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Set a goal — applications sent, problems solved, a skill learned — and track progress toward it."
          action={
            <GoalFormDialog
              trigger={
                <Button type="button">
                  <Plus className="h-4 w-4" /> Add your first goal
                </Button>
              }
            />
          }
        />
      )}
    </div>
  );
}
