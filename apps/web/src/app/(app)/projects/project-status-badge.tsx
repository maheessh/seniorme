import type { ProjectStatus } from "@ccc/db";
import { PROJECT_STATUS_LABEL } from "@ccc/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_VARIANT: Record<ProjectStatus, NonNullable<BadgeProps["variant"]>> = {
  IDEA: "default",
  PLANNING: "primary",
  BUILDING: "warning",
  TESTING: "warning",
  COMPLETED: "success",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PROJECT_STATUS_LABEL[status]}</Badge>;
}
