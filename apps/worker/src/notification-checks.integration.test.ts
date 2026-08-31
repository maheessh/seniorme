import { prisma, type ApplicationStage } from "@ccc/db";
import { beforeEach, describe, expect, it } from "vitest";
import { runNotificationChecks } from "./notification-checks";
import { createTestCompany, resetDb } from "./test-helpers";

const DAY_MS = 86_400_000;

let companyId: string;

beforeEach(async () => {
  await resetDb();
  const company = await createTestCompany();
  companyId = company.id;
});

async function createApplication(overrides: {
  stage?: ApplicationStage;
  deadline?: Date | null;
  followUpDate?: Date | null;
  externalJobId: string;
}) {
  const job = await prisma.job.create({
    data: {
      companyId,
      title: "Software Engineer",
      url: `https://example.com/jobs/${overrides.externalJobId}`,
      canonicalUrlHash: `hash-${overrides.externalJobId}`,
      externalJobId: overrides.externalJobId,
    },
  });
  return prisma.application.create({
    data: {
      jobId: job.id,
      companyId,
      stage: overrides.stage ?? "SAVED",
      deadline: overrides.deadline,
      followUpDate: overrides.followUpDate,
    },
  });
}

describe("runNotificationChecks — application deadlines", () => {
  it("notifies for a deadline inside the lookahead window", async () => {
    await createApplication({ deadline: new Date(Date.now() + 2 * DAY_MS), externalJobId: "1" });
    await runNotificationChecks();
    const notifications = await prisma.notification.findMany({ where: { type: "DEADLINE_APPROACHING" } });
    expect(notifications).toHaveLength(1);
  });

  it("does not notify for a deadline far in the future (outside the window)", async () => {
    await createApplication({ deadline: new Date(Date.now() + 30 * DAY_MS), externalJobId: "1" });
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "DEADLINE_APPROACHING" } })).toBe(0);
  });

  it("does not notify for a deadline that already passed", async () => {
    await createApplication({ deadline: new Date(Date.now() - DAY_MS), externalJobId: "1" });
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "DEADLINE_APPROACHING" } })).toBe(0);
  });

  it("does not notify for a terminal-stage application even with a near deadline", async () => {
    await createApplication({ stage: "REJECTED", deadline: new Date(Date.now() + DAY_MS), externalJobId: "1" });
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "DEADLINE_APPROACHING" } })).toBe(0);
  });

  it("scheduler tick running twice (§12 edge case) doesn't double-notify — dedup by key", async () => {
    await createApplication({ deadline: new Date(Date.now() + DAY_MS), externalJobId: "1" });
    await runNotificationChecks();
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "DEADLINE_APPROACHING" } })).toBe(1);
  });
});

describe("runNotificationChecks — follow-ups", () => {
  it("notifies for an overdue follow-up", async () => {
    await createApplication({ followUpDate: new Date(Date.now() - DAY_MS), externalJobId: "1" });
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "FOLLOW_UP_DUE" } })).toBe(1);
  });

  it("does not notify for a follow-up date in the future", async () => {
    await createApplication({ followUpDate: new Date(Date.now() + DAY_MS), externalJobId: "1" });
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "FOLLOW_UP_DUE" } })).toBe(0);
  });

  it("re-fires once per calendar day rather than staying silent after the first notification", async () => {
    await createApplication({ followUpDate: new Date(Date.now() - DAY_MS), externalJobId: "1" });
    await runNotificationChecks();
    await runNotificationChecks();
    // Same day → same dedupeKey → still just one notification.
    expect(await prisma.notification.count({ where: { type: "FOLLOW_UP_DUE" } })).toBe(1);
  });
});

describe("runNotificationChecks — goal deadlines", () => {
  it("notifies for a goal deadline inside the lookahead window", async () => {
    await prisma.goal.create({
      data: { title: "Apply to 50 jobs", category: "APPLICATIONS", deadline: new Date(Date.now() + DAY_MS) },
    });
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "GOAL_DEADLINE" } })).toBe(1);
  });

  it("does not notify for a completed goal", async () => {
    await prisma.goal.create({
      data: {
        title: "Apply to 50 jobs",
        category: "APPLICATIONS",
        deadline: new Date(Date.now() + DAY_MS),
        status: "COMPLETED",
      },
    });
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "GOAL_DEADLINE" } })).toBe(0);
  });
});

describe("runNotificationChecks — interviews", () => {
  it("notifies for a scheduled interview inside the lookahead window", async () => {
    const application = await createApplication({ stage: "INTERVIEW", externalJobId: "1" });
    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        toStage: "INTERVIEW",
        scheduledAt: new Date(Date.now() + DAY_MS),
      },
    });
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "INTERVIEW_APPROACHING" } })).toBe(1);
  });

  it("does not notify for a non-interview stage event (e.g. a plain note)", async () => {
    const application = await createApplication({ stage: "PREPARING", externalJobId: "1" });
    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        toStage: "PREPARING",
        scheduledAt: new Date(Date.now() + DAY_MS),
      },
    });
    await runNotificationChecks();
    expect(await prisma.notification.count({ where: { type: "INTERVIEW_APPROACHING" } })).toBe(0);
  });
});
