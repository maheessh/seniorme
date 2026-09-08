import type { NotificationType } from "@ccc/db";

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  NEW_MATCHING_JOB: "New job",
  DEADLINE_APPROACHING: "Deadline",
  FOLLOW_UP_DUE: "Follow-up",
  INTERVIEW_APPROACHING: "Interview",
  GOAL_DEADLINE: "Goal deadline",
  SCRAPER_FAILING: "Scraper issue",
  SCRAPER_REQUEST_RESOLVED: "Scraper update",
};
