import type { ApplicationStage } from "@ccc/db";
import { STAGE_LABEL } from "@ccc/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const STAGE_VARIANT: Record<ApplicationStage, NonNullable<BadgeProps["variant"]>> = {
  DISCOVERED: "default",
  INTERESTED: "primary",
  PREPARING: "primary",
  APPLIED: "primary",
  OA: "warning",
  RECRUITER_SCREEN: "warning",
  INTERVIEW: "warning",
  FINAL_INTERVIEW: "warning",
  OFFER: "success",
  REJECTED: "destructive",
  WITHDRAWN: "default",
  CLOSED: "default",
};

export function StageBadge({ stage }: { stage: ApplicationStage }) {
  return <Badge variant={STAGE_VARIANT[stage]}>{STAGE_LABEL[stage]}</Badge>;
}
