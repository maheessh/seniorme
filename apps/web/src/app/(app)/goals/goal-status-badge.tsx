import type { GoalStatus } from "@ccc/db";
import { GOAL_STATUS_LABEL } from "@ccc/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_VARIANT: Record<GoalStatus, NonNullable<BadgeProps["variant"]>> = {
  NOT_STARTED: "default",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  ABANDONED: "destructive",
};

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{GOAL_STATUS_LABEL[status]}</Badge>;
}
