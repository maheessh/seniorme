import type { GoalCategory, GoalStatus, ProjectStatus } from "@ccc/db";

export const PROJECT_STATUSES: ProjectStatus[] = ["IDEA", "PLANNING", "BUILDING", "TESTING", "COMPLETED"];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  IDEA: "Idea",
  PLANNING: "Planning",
  BUILDING: "Building",
  TESTING: "Testing",
  COMPLETED: "Completed",
};

export const GOAL_CATEGORIES: GoalCategory[] = [
  "PROJECT",
  "CODING_PRACTICE",
  "APPLICATIONS",
  "INTERVIEW_PREP",
  "LEARNING",
  "RESUME",
  "COURSEWORK",
  "OTHER",
];

export const GOAL_CATEGORY_LABEL: Record<GoalCategory, string> = {
  PROJECT: "Project",
  CODING_PRACTICE: "Coding practice",
  APPLICATIONS: "Applications",
  INTERVIEW_PREP: "Interview prep",
  LEARNING: "Learning",
  RESUME: "Resume",
  COURSEWORK: "Coursework",
  OTHER: "Other",
};

export const GOAL_STATUSES: GoalStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"];

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};
