import { prisma } from "@ccc/db";
import type { RawJobPosting } from "@ccc/scraper";
import { beforeEach, describe, expect, it } from "vitest";
import { upsertJobPosting } from "./scrape-processor";
import { createTestCareerSource, createTestCompany, resetDb } from "./test-helpers";

function posting(overrides: Partial<RawJobPosting> = {}): RawJobPosting {
  return {
    externalJobId: "123",
    title: "Software Engineer",
    url: "https://example.com/jobs/123",
    location: "Remote",
    workMode: "REMOTE",
    employmentType: "FULL_TIME",
    description: "Build things.",
    postedAt: new Date("2026-08-01"),
    ...overrides,
  };
}

let companyId: string;
let careerSourceId: string;

beforeEach(async () => {
  await resetDb();
  const company = await createTestCompany();
  const source = await createTestCareerSource(company.id);
  companyId = company.id;
  careerSourceId = source.id;
});

describe("upsertJobPosting — new postings", () => {
  it("creates a new Job row and returns 1", async () => {
    const created = await upsertJobPosting(careerSourceId, companyId, "Test Co", posting());
    expect(created).toBe(1);
    const jobs = await prisma.job.findMany({ where: { companyId } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ title: "Software Engineer", isRemoved: false });
  });

  it("logs a job_discovered activity event for a new posting", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting());
    const events = await prisma.activityEvent.findMany({ where: { type: "job_discovered" } });
    expect(events).toHaveLength(1);
  });
});

describe("upsertJobPosting — duplicate jobs across runs (§12 edge case)", () => {
  it("the second run with an identical posting returns 0, not a new row", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting());
    const secondRun = await upsertJobPosting(careerSourceId, companyId, "Test Co", posting());
    expect(secondRun).toBe(0);
    const jobs = await prisma.job.findMany({ where: { companyId } });
    expect(jobs).toHaveLength(1);
  });

  it("two postings with the same externalJobId but different URLs are still one job, not two", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting());
    await upsertJobPosting(
      careerSourceId,
      companyId,
      "Test Co",
      posting({ url: "https://example.com/jobs/123?utm_source=different" }),
    );
    const jobs = await prisma.job.findMany({ where: { companyId } });
    expect(jobs).toHaveLength(1);
  });
});

describe("upsertJobPosting — changed job URL, same external ID (§12 edge case)", () => {
  it("updates the stored URL in place rather than leaving it stale", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting());
    await upsertJobPosting(
      careerSourceId,
      companyId,
      "Test Co",
      posting({ url: "https://example.com/jobs/123-renamed-slug" }),
    );
    const jobs = await prisma.job.findMany({ where: { companyId } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].url).toBe("https://example.com/jobs/123-renamed-slug");
  });
});

describe("upsertJobPosting — changed metadata refreshes in place", () => {
  it("refreshes the title on an existing job when it changes", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ title: "Old Title" }));
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ title: "New Title" }));
    const job = await prisma.job.findFirstOrThrow({ where: { companyId } });
    expect(job.title).toBe("New Title");
  });

  it("refreshes postedAt when it changes", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ postedAt: new Date("2026-08-01") }));
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ postedAt: new Date("2026-08-15") }));
    const job = await prisma.job.findFirstOrThrow({ where: { companyId } });
    expect(job.postedAt?.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("refreshes description and its hash together, and logs a job_updated event", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ description: "v1" }));
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ description: "v2" }));
    const job = await prisma.job.findFirstOrThrow({ where: { companyId } });
    expect(job.descriptionRaw).toBe("v2");
    const events = await prisma.activityEvent.findMany({ where: { type: "job_updated" } });
    expect(events).toHaveLength(1);
  });

  it("syncs externalJobId when an adapter's id scheme changes for an already-known posting", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ externalJobId: "hash-abc123" }));
    // Same URL (matches via canonicalUrlHash), but a different adapter tier now supplies a
    // numeric id instead of the old hash-based one.
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ externalJobId: "456" }));
    const job = await prisma.job.findFirstOrThrow({ where: { companyId } });
    expect(job.externalJobId).toBe("456");
  });
});

describe("upsertJobPosting — removed job (§12 edge case)", () => {
  it("re-appearing after being marked removed flips isRemoved back to false", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting());
    await prisma.job.updateMany({ where: { companyId }, data: { isRemoved: true } });
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting());
    const job = await prisma.job.findFirstOrThrow({ where: { companyId } });
    expect(job.isRemoved).toBe(false);
  });
});

describe("upsertJobPosting — missing metadata (§12 edge case)", () => {
  it("handles a posting with no description, location, or postedAt without throwing", async () => {
    const created = await upsertJobPosting(
      careerSourceId,
      companyId,
      "Test Co",
      posting({ description: null, location: null, postedAt: null }),
    );
    expect(created).toBe(1);
    const job = await prisma.job.findFirstOrThrow({ where: { companyId } });
    expect(job.descriptionRaw).toBeNull();
    expect(job.location).toBeNull();
    expect(job.postedAt).toBeNull();
  });

  it("a posting with postedAt: null never overwrites an already-known postedAt", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ postedAt: new Date("2026-08-01") }));
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ postedAt: null }));
    const job = await prisma.job.findFirstOrThrow({ where: { companyId } });
    expect(job.postedAt).not.toBeNull();
  });
});

describe("upsertJobPosting — fuzzy duplicate flagging", () => {
  it("flags a similarly-titled posting at the same company for review", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ externalJobId: "1", title: "Senior Software Engineer, Backend" }));
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ externalJobId: "2", url: "https://example.com/jobs/2", title: "Senior Software Engineer Backend" }));
    const flagged = await prisma.job.findFirst({ where: { externalJobId: "2" } });
    expect(flagged?.possibleDuplicateOfId).not.toBeNull();
  });

  it("does not flag an unrelated title as a duplicate", async () => {
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ externalJobId: "1", title: "Software Engineer" }));
    await upsertJobPosting(careerSourceId, companyId, "Test Co", posting({ externalJobId: "2", url: "https://example.com/jobs/2", title: "Marketing Manager" }));
    const other = await prisma.job.findFirst({ where: { externalJobId: "2" } });
    expect(other?.possibleDuplicateOfId).toBeNull();
  });
});
