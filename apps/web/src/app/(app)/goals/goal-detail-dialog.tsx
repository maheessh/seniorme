"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { GoalWithMilestones } from "@/lib/server/services/goals";
import { addGoalMilestoneAction, deleteGoalMilestoneAction, toggleGoalMilestoneAction } from "./actions";
import { GoalStatusBadge } from "./goal-status-badge";

export function GoalDetailDialog({
  goal,
  open,
  onOpenChange,
}: {
  goal: GoalWithMilestones;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [, startTransition] = useTransition();
  const hasTarget = goal.targetValue != null && goal.targetValue > 0;
  const progressPercent = hasTarget ? Math.min(100, (goal.currentValue / goal.targetValue!) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal.title}</DialogTitle>
          {goal.notes ? <DialogDescription>{goal.notes}</DialogDescription> : null}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <GoalStatusBadge status={goal.status} />
          </div>

          {hasTarget ? (
            <div className="flex items-center gap-2">
              <ProgressBar value={progressPercent} />
              <span className="shrink-0 text-xs text-muted-foreground">
                {goal.currentValue}/{goal.targetValue}
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Milestones</p>
            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {goal.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones yet.</p>
              ) : (
                goal.milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={milestone.isDone}
                      onChange={() => startTransition(() => void toggleGoalMilestoneAction(milestone.id))}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span
                      className={`flex-1 text-sm ${milestone.isDone ? "text-muted-foreground line-through" : ""}`}
                    >
                      {milestone.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void deleteGoalMilestoneAction(milestone.id))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete milestone ${milestone.title}`}
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
                if (!milestoneTitle.trim()) return;
                const title = milestoneTitle;
                setMilestoneTitle("");
                startTransition(() => void addGoalMilestoneAction(goal.id, title));
              }}
              className="flex gap-2"
            >
              <Input
                value={milestoneTitle}
                onChange={(event) => setMilestoneTitle(event.target.value)}
                placeholder="Add a milestone…"
                className="flex-1"
              />
              <Button type="submit" size="icon" aria-label="Add milestone">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
