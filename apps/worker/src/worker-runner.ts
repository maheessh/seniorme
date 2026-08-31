import type { ScrapeJobData } from "@ccc/shared";
import { SCRAPE_QUEUE_NAME } from "@ccc/shared";
import { Worker, type Job } from "bullmq";
import { logger } from "./logger";
import { connection } from "./redis";
import { enqueueDueSources } from "./scheduler";
import { processScrapeSource } from "./scrape-processor";

export function startWorker(): Worker {
  const worker = new Worker(
    SCRAPE_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === "scheduler-tick") {
        await enqueueDueSources();
        return;
      }
      if (job.name === "scrape-career-source") {
        const { careerSourceId, triggeredBy } = job.data as ScrapeJobData;
        await processScrapeSource(careerSourceId, triggeredBy);
        return;
      }
      logger.warn({ jobName: job.name }, "Unknown job type, skipping");
    },
    { connection, concurrency: 3 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, error: err.message }, "BullMQ job failed");
  });

  return worker;
}
