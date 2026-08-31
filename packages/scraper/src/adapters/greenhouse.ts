import { safeFetchJson } from "../safe-fetch";
import { extractSlug, mapWorkMode } from "../normalize";
import type { CareerSiteAdapter, RawJobPosting } from "../types";

type GreenhouseJob = {
  id: number;
  absolute_url: string;
  updated_at: string;
  first_published?: string | null;
  title: string;
  location: { name: string } | null;
  content: string | null;
};

type GreenhouseResponse = { jobs: GreenhouseJob[] };

// Verified against a live board (boards-api.greenhouse.io/v1/boards/stripe/jobs) during
// implementation. Greenhouse doesn't expose a reliable structured employment-type field on
// the base jobs endpoint, so employmentType is left null rather than guessed.
export const greenhouseAdapter: CareerSiteAdapter = {
  type: "GREENHOUSE",
  matches(url) {
    return /(^|\.)greenhouse\.io$/i.test(url.hostname);
  },
  async fetchPostings(sourceUrl) {
    const token = extractSlug(sourceUrl);
    if (!token) {
      throw new Error(`Could not determine the Greenhouse board token from ${sourceUrl}`);
    }

    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
    const data = await safeFetchJson<GreenhouseResponse>(apiUrl);

    const postings: RawJobPosting[] = data.jobs.map((job) => ({
      externalJobId: String(job.id),
      title: job.title,
      url: job.absolute_url,
      location: job.location?.name ?? null,
      workMode: mapWorkMode(job.location?.name),
      employmentType: null,
      description: job.content ?? null,
      postedAt: job.first_published
        ? new Date(job.first_published)
        : job.updated_at
          ? new Date(job.updated_at)
          : null,
    }));

    return { postings };
  },
};
