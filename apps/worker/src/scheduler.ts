import { prisma } from "@ccc/db";
import type { ScrapeJobData } from "@ccc/shared";
import { logger } from "./logger";
import { scrapeQueue } from "./queue";

const TICK_INTERVAL_MS = 5 * 60 * 1000;

export async function registerScheduler(): Promise<void> {
  await scrapeQueue.upsertJobScheduler("scheduler-tick", { every: TICK_INTERVAL_MS }, { name: "scheduler-tick" });
  logger.info({ everyMs: TICK_INTERVAL_MS }, "Registered scheduler tick");
}

/**
 * Finds active CareerSources whose check interval has elapsed and enqueues a scrape job for
 * each. Prisma can't express a column-vs-column "now - lastCheckedAt >= checkFrequencyMin"
 * comparison in its query builder, so the interval check happens in application code.
 */
export async function enqueueDueSources(): Promise<void> {
  const activeSources = await prisma.careerSource.findMany({
    where: { isActive: true, company: { monitoringEnabled: true } },
    select: { id: true, lastCheckedAt: true, checkFrequencyMin: true },
  });

  const now = Date.now();
  const due = activeSources.filter((source) => {
    if (!source.lastCheckedAt) return true;
    return (now - source.lastCheckedAt.getTime()) / 60_000 >= source.checkFrequencyMin;
  });

  for (const source of due) {
    const jobId = `scrape-${source.id}`;

    // See the matching comment in apps/web's career-sources.ts enqueue(): add() dedupes by
    // jobId, which is desired while a scrape is still in flight, but is a silent no-op once
    // that job has completed/failed — remove it first so the next scheduled check actually runs.
    const existing = await scrapeQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") {
        await existing.remove();
      }
    }

    await scrapeQueue.add(
      "scrape-career-source",
      { careerSourceId: source.id, triggeredBy: "scheduler" } satisfies ScrapeJobData,
      {
        jobId,
        removeOnComplete: 200,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
  }

  if (due.length > 0) {
    logger.info({ count: due.length }, "Enqueued due career sources for scraping");
  }
}
