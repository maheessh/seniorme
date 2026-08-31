export const SCRAPE_QUEUE_NAME = "career-scrape";

export type ScrapeJobData = {
  careerSourceId: string;
  triggeredBy: "scheduler" | "manual";
};
