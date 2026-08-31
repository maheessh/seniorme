"use client";

import { GOAL_CATEGORY_LABEL } from "@ccc/shared";
import { format, isPast } from "date-fns";
import { Minus, Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import type { GoalWithMilestones } from "@/lib/server/services/goals";
import { incrementGoalAction } from "./actions";
import { DeleteGoalButton } from "./delete-goal-button";
import { GoalDetailDialog } from "./goal-detail-dialog";
import { GoalFormDialog } from "./goal-form-dialog";
import { GoalStatusBadge } from "./goal-status-badge";

export function GoalCard({ goal }: { goal: GoalWithMilestones }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [, startTransition] = useTransition();
  const hasTarget = goal.targetValue != null && goal.targetValue > 0;
  const progressPercent = hasTarget ? Math.min(100, (goal.currentValue / goal.targetValue!) * 100) : 0;
  const deadlinePast = goal.deadline && isPast(goal.deadline) && goal.status !== "COMPLETED";

  return (
    <>
      <Card className="flex cursor-pointer flex-col gap-3 p-5" onClick={() => setDetailOpen(true)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium leading-tight">{goal.title}</p>
            <p className="text-xs text-muted-foreground">{GOAL_CATEGORY_LABEL[goal.category]}</p>
          </div>
          <div className="flex shrink-0 gap-0.5" onClick={(event) => event.stopPropagation()}>
            <GoalFormDialog
              goal={goal}
              trigger={
                <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${goal.title}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
            <DeleteGoalButton id={goal.id} title={goal.title} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <GoalStatusBadge status={goal.status} />
          <Badge variant={goal.priority === "HIGH" ? "warning" : "default"}>{goal.priority}</Badge>
          {goal.deadline ? (
            <Badge variant={deadlinePast ? "destructive" : "default"}>{format(goal.deadline, "MMM d, yyyy")}</Badge>
          ) : null}
        </div>

        {hasTarget ? (
          <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Decrease progress"
              onClick={() => startTransition(() => void incrementGoalAction(goal.id, -1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <div className="flex-1">
              <ProgressBar value={progressPercent} />
            </div>
            <span className={cn("shrink-0 text-xs text-muted-foreground")}>
              {goal.currentValue}/{goal.targetValue}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Increase progress"
              onClick={() => startTransition(() => void incrementGoalAction(goal.id, 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </Card>

      <GoalDetailDialog goal={goal} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}
