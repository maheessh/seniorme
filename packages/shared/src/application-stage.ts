import type { ApplicationStage } from "@ccc/db";

// Pure constants shared between server code and client components. Deliberately kept out of
// the web app's server-only service layer (packages that import @ccc/db's runtime — Prisma,
// pg) — importing those into a "use client" component would drag Node-only dependencies into
// the browser bundle and break the build.

export const PIPELINE_STAGES: ApplicationStage[] = [
  "SAVED",
  "PREPARING",
  "APPLIED",
  "OA",
  "RECRUITER_SCREEN",
  "INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
];

export const TERMINAL_STAGES: ApplicationStage[] = ["REJECTED", "WITHDRAWN", "CLOSED"];

export const ALL_STAGES: ApplicationStage[] = [...PIPELINE_STAGES, ...TERMINAL_STAGES];

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  SAVED: "Saved",
  PREPARING: "Preparing",
  APPLIED: "Applied",
  OA: "OA / Assessment",
  RECRUITER_SCREEN: "Recruiter Screen",
  INTERVIEW: "Interview",
  FINAL_INTERVIEW: "Final Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  CLOSED: "Closed",
};
