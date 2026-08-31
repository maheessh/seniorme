import { SCRAPE_QUEUE_NAME } from "@ccc/shared";
import { Queue } from "bullmq";
import { connection } from "./redis";

export const scrapeQueue = new Queue(SCRAPE_QUEUE_NAME, { connection });
