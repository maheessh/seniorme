import { SCRAPE_QUEUE_NAME } from "@ccc/shared";
import { Queue } from "bullmq";
import IORedis from "ioredis";

declare global {
  var __queueConnection: IORedis | undefined;
  var __scrapeQueue: Queue | undefined;
}

function createConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  return new IORedis(url, { maxRetriesPerRequest: null });
}

const connection = globalThis.__queueConnection ?? createConnection();
if (process.env.NODE_ENV !== "production") globalThis.__queueConnection = connection;

// This is a producer only — the web app enqueues scrape jobs, but only the worker process
// consumes them, keeping the web request/response cycle free of long-running scrape work.
export const scrapeQueue = globalThis.__scrapeQueue ?? new Queue(SCRAPE_QUEUE_NAME, { connection });
if (process.env.NODE_ENV !== "production") globalThis.__scrapeQueue = scrapeQueue;
