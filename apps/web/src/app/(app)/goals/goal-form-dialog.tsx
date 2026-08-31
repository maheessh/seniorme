"use client";

import { GOAL_CATEGORIES, GOAL_CATEGORY_LABEL, GOAL_STATUS_LABEL, GOAL_STATUSES } from "@ccc/shared";
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
import type { GoalWithMilestones } from "@/lib/server/services/goals";
import { createGoalAction, updateGoalAction, type GoalFormState } from "./actions";

function toInputDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function GoalFormDialog({ goal, trigger }: { goal?: GoalWithMilestones; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const action = goal ? updateGoalAction.bind(null, goal.id) : createGoalAction;
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(action, undefined);

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
          <DialogTitle>{goal ? "Edit goal" : "Add goal"}</DialogTitle>
          <DialogDescription>
            {goal ? "Update this goal." : "Set a goal and track progress toward it."}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={goal?.title} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue={goal?.category ?? "OTHER"}>
                {GOAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {GOAL_CATEGORY_LABEL[category]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" defaultValue={goal?.priority ?? "MEDIUM"}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="targetValue">Target (optional)</Label>
              <Input
                id="targetValue"
                name="targetValue"
                type="number"
                min={0}
                placeholder="e.g. 50"
                defaultValue={goal?.targetValue ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentValue">Current progress</Label>
              <Input
                id="currentValue"
                name="currentValue"
                type="number"
                min={0}
                defaultValue={goal?.currentValue ?? 0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline">Deadline</Label>
              <Input id="deadline" name="deadline" type="date" defaultValue={toInputDate(goal?.deadline)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={goal?.status ?? "NOT_STARTED"}>
                {GOAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {GOAL_STATUS_LABEL[status]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={goal?.notes ?? ""} />
          </div>

          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <Button type="submit" size="lg" disabled={pending} className="mt-1">
            {pending ? "Saving…" : goal ? "Save changes" : "Add goal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
