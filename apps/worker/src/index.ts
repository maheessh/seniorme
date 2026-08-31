import { prisma } from "@ccc/db";
import { logger } from "./logger";
import { connection } from "./redis";

// This process is intentionally kept separate from the Next.js `web` app so that
// long-running/scheduled work (career-page monitoring, starting in Phase 2) never
// depends on a serverless-friendly request/response lifecycle. Right now it only
// proves out the topology: it can reach Postgres and Redis and stays alive under
// Docker Compose. The BullMQ scheduler + queue + adapters land in Phase 2.

async function main() {
  await connection.ping();
  logger.info("Connected to Redis");

  await prisma.$queryRaw`SELECT 1`;
  logger.info("Connected to Postgres");

  logger.info("Worker process ready (no scheduled jobs registered yet — see Phase 2)");
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down worker");
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
