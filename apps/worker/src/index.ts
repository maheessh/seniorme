import { prisma } from "@ccc/db";
import type { Worker } from "bullmq";
import { logger } from "./logger";
import { scrapeQueue } from "./queue";
import { connection } from "./redis";
import { registerScheduler } from "./scheduler";
import { startWorker } from "./worker-runner";

let worker: Worker | undefined;

async function main() {
  await connection.ping();
  logger.info("Connected to Redis");

  await prisma.$queryRaw`SELECT 1`;
  logger.info("Connected to Postgres");

  worker = startWorker();
  logger.info("BullMQ worker started (concurrency: 3)");

  await registerScheduler();

  logger.info("Worker process ready — career-page monitoring is live");
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down worker");
  await worker?.close();
  await scrapeQueue.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  logger.error({ error }, "Worker failed to start");
  process.exit(1);
});
