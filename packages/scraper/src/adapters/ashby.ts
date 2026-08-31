import { safeFetchJson } from "../safe-fetch";
import { extractSlug, mapEmploymentType, mapWorkMode } from "../normalize";
import type { CareerSiteAdapter, RawJobPosting } from "../types";

type AshbyJob = {
  id: string;
  title: string;
  location?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  publishedAt?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  descriptionPlain?: string | null;
  isListed?: boolean;
};

type AshbyResponse = { jobs: AshbyJob[] };

// Verified against several live boards (api.ashbyhq.com/posting-api/job-board/ramp, /notion,
// /linear) during implementation.
export const ashbyAdapter: CareerSiteAdapter = {
  type: "ASHBY",
  matches(url) {
    return /(^|\.)ashbyhq\.com$/i.test(url.hostname);
  },
  async fetchPostings(sourceUrl) {
    const org = extractSlug(sourceUrl);
    if (!org) {
      throw new Error(`Could not determine the Ashby job board name from ${sourceUrl}`);
    }

    const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}`;
    const data = await safeFetchJson<AshbyResponse>(apiUrl);

    const postings: RawJobPosting[] = data.jobs
      .filter((job) => job.isListed !== false)
      .map((job) => ({
        externalJobId: job.id,
        title: job.title,
        url: job.jobUrl ?? job.applyUrl ?? sourceUrl,
        location: job.location ?? null,
        workMode: mapWorkMode(job.workplaceType ?? job.location),
        employmentType: mapEmploymentType(job.employmentType),
        description: job.descriptionPlain ?? null,
        postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
      }));

    return { postings };
  },
};
