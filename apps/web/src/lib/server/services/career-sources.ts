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

function enqueue(careerSourceId: string, triggeredBy: ScrapeJobData["triggeredBy"]) {
  return scrapeQueue.add(
    "scrape-career-source",
    { careerSourceId, triggeredBy } satisfies ScrapeJobData,
    {
      jobId: `scrape-${careerSourceId}`,
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
