import { prisma } from "@ccc/db";
import { TERMINAL_STAGES } from "@ccc/shared";
import { dispatchNotification } from "./notifications/channels";

const LOOKAHEAD_DAYS = 3;
const DAY_MS = 86_400_000;

const INTERVIEW_STAGES = ["OA", "RECRUITER_SCREEN", "INTERVIEW", "FINAL_INTERVIEW"] as const;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Runs on every scheduler tick (see worker-runner.ts). Each check is a cheap indexed query —
 * no external requests — so piggybacking on the existing 5-minute tick (rather than a second
 * BullMQ scheduler) is fine. Every notification carries a stable dedupeKey so re-running this
 * on a 5-minute cadence doesn't re-notify about the same deadline/event on every tick.
 */
export async function runNotificationChecks(): Promise<void> {
  const now = new Date();
  const lookahead = new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS);

  await Promise.all([
    checkApplicationDeadlines(now, lookahead),
    checkFollowUps(now),
    checkInterviews(now, lookahead),
    checkGoalDeadlines(now, lookahead),
  ]);
}

async function checkApplicationDeadlines(now: Date, lookahead: Date): Promise<void> {
  const applications = await prisma.application.findMany({
    where: {
      deadline: { gte: now, lte: lookahead },
      stage: { notIn: TERMINAL_STAGES },
    },
    include: { job: { select: { title: true } }, company: { select: { name: true } } },
  });

  for (const application of applications) {
    if (!application.deadline) continue;
    await dispatchNotification({
      type: "DEADLINE_APPROACHING",
      title: `Deadline approaching: ${application.job.title} at ${application.company.name}`,
      body: `Due ${application.deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`,
      linkUrl: "/pipeline",
      entityType: "application",
      entityId: application.id,
      dedupeKey: `deadline:${application.id}:${dayKey(application.deadline)}`,
    });
  }
}

async function checkFollowUps(now: Date): Promise<void> {
  const applications = await prisma.application.findMany({
    where: {
      followUpDate: { lte: now },
      stage: { notIn: TERMINAL_STAGES },
    },
    include: { job: { select: { title: true } }, company: { select: { name: true } } },
  });

  for (const application of applications) {
    await dispatchNotification({
      type: "FOLLOW_UP_DUE",
      title: `Follow up: ${application.job.title} at ${application.company.name}`,
      body: "You planned to follow up on this application.",
      linkUrl: "/pipeline",
      entityType: "application",
      entityId: application.id,
      // Re-fires once per day until the follow-up date is cleared or pushed out — a deliberate
      // recurring nudge rather than a single heads-up, unlike a fixed-date deadline.
      dedupeKey: `followup:${application.id}:${dayKey(now)}`,
    });
  }
}

async function checkInterviews(now: Date, lookahead: Date): Promise<void> {
  const events = await prisma.applicationEvent.findMany({
    where: {
      scheduledAt: { gte: now, lte: lookahead },
      toStage: { in: [...INTERVIEW_STAGES] },
    },
    include: {
      application: {
        include: { job: { select: { title: true } }, company: { select: { name: true } } },
      },
    },
  });

  for (const event of events) {
    if (!event.scheduledAt) continue;
    await dispatchNotification({
      type: "INTERVIEW_APPROACHING",
      title: `${event.toStage.replace(/_/g, " ")} coming up: ${event.application.job.title} at ${event.application.company.name}`,
      body: `Scheduled for ${event.scheduledAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`,
      linkUrl: "/pipeline",
      entityType: "application",
      entityId: event.applicationId,
      dedupeKey: `interview:${event.id}`,
    });
  }
}

async function checkGoalDeadlines(now: Date, lookahead: Date): Promise<void> {
  const goals = await prisma.goal.findMany({
    where: {
      deadline: { gte: now, lte: lookahead },
      status: { notIn: ["COMPLETED", "ABANDONED"] },
    },
  });

  for (const goal of goals) {
    if (!goal.deadline) continue;
    await dispatchNotification({
      type: "GOAL_DEADLINE",
      title: `Goal deadline approaching: ${goal.title}`,
      body: `Due ${goal.deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`,
      linkUrl: "/goals",
      entityType: "goal",
      entityId: goal.id,
      dedupeKey: `goal-deadline:${goal.id}:${dayKey(goal.deadline)}`,
    });
  }
}
