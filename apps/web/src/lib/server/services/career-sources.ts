import { prisma } from "@ccc/db";
import { detectSourceType } from "@ccc/scraper";
import type { ScrapeJobData } from "@ccc/shared";
import { scrapeQueue } from "@/lib/server/queue";

const MANUAL_TRIGGER_MIN_INTERVAL_MS = 5 * 60 * 1000;

export class TriggerTooSoonError extends Error {
  constructor(public retryAfterMs: number) {
    super("This source was checked recently — try again shortly.");
    this.name = "TriggerTooSoonError";
  }
}

export function addCareerSource(companyId: string, url: string, checkFrequencyMin: number) {
  return prisma.careerSource.create({
    data: { companyId, url, checkFrequencyMin, sourceType: detectSourceType(url) },
  });
}

export function deleteCareerSource(id: string) {
  return prisma.careerSource.delete({ where: { id } });
}

export function setCareerSourceActive(id: string, isActive: boolean) {
  return prisma.careerSource.update({ where: { id }, data: { isActive } });
}

async function enqueue(careerSourceId: string, triggeredBy: ScrapeJobData["triggeredBy"]) {
  const jobId = `scrape-${careerSourceId}`;

  // BullMQ dedupes add() by jobId, which is exactly what we want while a scrape for this source
  // is still active/waiting/delayed — it prevents two concurrent scrapes of the same page. But
  // once that job reaches a terminal state (completed/failed), add() with the same jobId is a
  // silent no-op rather than a fresh run: without this, every retrigger past the first one would
  // go nowhere. Removing the finished job first restores the "run again" behavior while keeping
  // the in-flight dedup.
  const existing = await scrapeQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      await existing.remove();
    }
  }

  return scrapeQueue.add(
    "scrape-career-source",
    { careerSourceId, triggeredBy } satisfies ScrapeJobData,
    {
      jobId,
      removeOnComplete: 200,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
    },
  );
}

export async function triggerScrape(careerSourceId: string): Promise<void> {
  const source = await prisma.careerSource.findUniqueOrThrow({ where: { id: careerSourceId } });

  if (source.lastCheckedAt) {
    const elapsed = Date.now() - source.lastCheckedAt.getTime();
    if (elapsed < MANUAL_TRIGGER_MIN_INTERVAL_MS) {
      throw new TriggerTooSoonError(MANUAL_TRIGGER_MIN_INTERVAL_MS - elapsed);
    }
  }

  await enqueue(careerSourceId, "manual");
}

/**
 * Triggers a scrape for every active career page a company has, so "scrape now" can live on the
 * company itself rather than requiring the user to open each source individually. Every scrape
 * already re-fetches the full listing and only creates a Job row for postings that don't already
 * exist (see upsertJobPosting in the worker) — there's no separate "incremental" mode to
 * configure, because none of the supported ATS/HTML sources expose a "changes since" endpoint;
 * the dedup happens after the fetch, not before it. Sources checked within the last 5 minutes are
 * silently skipped rather than erroring the whole batch.
 */
export async function triggerCompanyScrape(companyId: string): Promise<{ queued: number; skipped: number }> {
  const sources = await prisma.careerSource.findMany({
    where: { companyId, isActive: true },
    select: { id: true, lastCheckedAt: true },
  });

  let queued = 0;
  let skipped = 0;
  for (const source of sources) {
    const elapsed = source.lastCheckedAt ? Date.now() - source.lastCheckedAt.getTime() : Infinity;
    if (elapsed < MANUAL_TRIGGER_MIN_INTERVAL_MS) {
      skipped += 1;
      continue;
    }
    await enqueue(source.id, "manual");
    queued += 1;
  }

  return { queued, skipped };
}
