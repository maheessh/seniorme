import { prisma } from "@ccc/db";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanupIgnoredJobs } from "./inbox-cleanup";
import { createTestCareerSource, createTestCompany, createTestUser, resetDb } from "./test-helpers";

let companyId: string;
let careerSourceId: string;
let userId: string;

beforeEach(async () => {
  await resetDb();
  const company = await createTestCompany();
  const source = await createTestCareerSource(company.id);
  const user = await createTestUser();
  companyId = company.id;
  careerSourceId = source.id;
  userId = user.id;
});

async function createJobWithStatus(overrides: {
  status?: "NEW" | "SAVED" | "APPLIED" | "IGNORED";
  updatedAt?: Date;
  externalJobId: string;
}) {
  const job = await prisma.job.create({
    data: {
      companyId,
      careerSourceId,
      title: "Software Engineer",
      url: `https://example.com/jobs/${overrides.externalJobId}`,
      canonicalUrlHash: `hash-${overrides.externalJobId}`,
      externalJobId: overrides.externalJobId,
    },
  });
  const status = await prisma.userJobStatus.create({
    data: { userId, jobId: job.id, status: overrides.status ?? "NEW" },
  });
  if (overrides.updatedAt) {
    // updatedAt is Prisma-managed (@updatedAt) — bypass it with a raw update to backdate a row
    // as if it had been sitting untouched since that time, matching how a real ignored job ages.
    await prisma.$executeRaw`UPDATE "UserJobStatus" SET "updatedAt" = ${overrides.updatedAt} WHERE id = ${status.id}`;
  }
  return job;
}

describe("cleanupIgnoredJobs", () => {
  it("deletes an ignored job's status past the retention window, but keeps the shared Job row", async () => {
    await createJobWithStatus({ status: "IGNORED", updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), externalJobId: "1" });
    await cleanupIgnoredJobs();
    expect(await prisma.userJobStatus.count()).toBe(0);
    expect(await prisma.job.count()).toBe(1);
  });

  it("leaves a recently-ignored job's status alone — grace period for a misclick", async () => {
    await createJobWithStatus({ status: "IGNORED", updatedAt: new Date(), externalJobId: "1" });
    await cleanupIgnoredJobs();
    expect(await prisma.userJobStatus.count()).toBe(1);
  });

  it("never deletes a NEW/SAVED/APPLIED status regardless of age", async () => {
    const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await createJobWithStatus({ status: "NEW", updatedAt: old, externalJobId: "1" });
    await createJobWithStatus({ status: "SAVED", updatedAt: old, externalJobId: "2" });
    await createJobWithStatus({ status: "APPLIED", updatedAt: old, externalJobId: "3" });
    await cleanupIgnoredJobs();
    expect(await prisma.userJobStatus.count()).toBe(3);
  });

  it("never deletes an ignored status that has an Application for that user (defensive guard)", async () => {
    const job = await createJobWithStatus({
      status: "IGNORED",
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      externalJobId: "1",
    });
    await prisma.application.create({ data: { jobId: job.id, companyId, userId, stage: "SAVED" } });
    await cleanupIgnoredJobs();
    expect(await prisma.userJobStatus.count()).toBe(1);
  });

  it("only purges the statuses actually past the window, leaving the rest", async () => {
    await createJobWithStatus({ status: "IGNORED", updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), externalJobId: "old" });
    await createJobWithStatus({ status: "IGNORED", updatedAt: new Date(), externalJobId: "new" });
    await cleanupIgnoredJobs();
    const remaining = await prisma.userJobStatus.findMany({ include: { job: true } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].job.externalJobId).toBe("new");
  });
});
