import { prisma } from "@ccc/db";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanupIgnoredJobs } from "./inbox-cleanup";
import { createTestCareerSource, createTestCompany, resetDb } from "./test-helpers";

let companyId: string;
let careerSourceId: string;

beforeEach(async () => {
  await resetDb();
  const company = await createTestCompany();
  const source = await createTestCareerSource(company.id);
  companyId = company.id;
  careerSourceId = source.id;
});

async function createJob(overrides: {
  inboxStatus?: "NEW" | "SAVED" | "APPLIED" | "IGNORED";
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
      inboxStatus: overrides.inboxStatus ?? "NEW",
    },
  });
  if (overrides.updatedAt) {
    // updatedAt is Prisma-managed (@updatedAt) — bypass it with a raw update to backdate a row
    // as if it had been sitting untouched since that time, matching how a real ignored job ages.
    await prisma.$executeRaw`UPDATE "Job" SET "updatedAt" = ${overrides.updatedAt} WHERE id = ${job.id}`;
  }
  return job;
}

describe("cleanupIgnoredJobs", () => {
  it("deletes an ignored job past the retention window", async () => {
    await createJob({ inboxStatus: "IGNORED", updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), externalJobId: "1" });
    await cleanupIgnoredJobs();
    expect(await prisma.job.count()).toBe(0);
  });

  it("leaves a recently-ignored job alone — grace period for a misclick", async () => {
    await createJob({ inboxStatus: "IGNORED", updatedAt: new Date(), externalJobId: "1" });
    await cleanupIgnoredJobs();
    expect(await prisma.job.count()).toBe(1);
  });

  it("never deletes a NEW/SAVED/APPLIED job regardless of age", async () => {
    const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await createJob({ inboxStatus: "NEW", updatedAt: old, externalJobId: "1" });
    await createJob({ inboxStatus: "SAVED", updatedAt: old, externalJobId: "2" });
    await createJob({ inboxStatus: "APPLIED", updatedAt: old, externalJobId: "3" });
    await cleanupIgnoredJobs();
    expect(await prisma.job.count()).toBe(3);
  });

  it("never deletes an ignored job that has an Application (defensive guard)", async () => {
    const job = await createJob({
      inboxStatus: "IGNORED",
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      externalJobId: "1",
    });
    await prisma.application.create({ data: { jobId: job.id, companyId, stage: "SAVED" } });
    await cleanupIgnoredJobs();
    expect(await prisma.job.count()).toBe(1);
  });

  it("only purges the jobs actually past the window, leaving the rest", async () => {
    await createJob({ inboxStatus: "IGNORED", updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), externalJobId: "old" });
    await createJob({ inboxStatus: "IGNORED", updatedAt: new Date(), externalJobId: "new" });
    await cleanupIgnoredJobs();
    const remaining = await prisma.job.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].externalJobId).toBe("new");
  });
});
