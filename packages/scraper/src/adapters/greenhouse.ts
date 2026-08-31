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

function mapGreenhouseJob(job: GreenhouseJob): RawJobPosting {
  return {
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
  };
}

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

    return { postings: data.jobs.map(mapGreenhouseJob) };
  },
};

/**
 * Matches standard `boards.greenhouse.io/{token}/jobs/{id}` and
 * `job-boards.greenhouse.io/{token}/jobs/{id}` URLs — NOT the many large companies that proxy
 * Greenhouse through their own domain (e.g. stripe.com/jobs/search?gh_jid=...), which have no
 * derivable board token and fall through to the JSON-LD/OpenGraph tiers instead.
 */
export function parseGreenhouseJobUrl(url: URL): { token: string; jobId: string } | null {
  if (!/(^|\.)greenhouse\.io$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (!match) return null;
  return { token: match[1], jobId: match[2] };
}

export async function fetchSingleGreenhouseJob(url: URL): Promise<RawJobPosting | null> {
  const parsed = parseGreenhouseJobUrl(url);
  if (!parsed) return null;

  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(parsed.token)}/jobs/${encodeURIComponent(parsed.jobId)}?content=true`;
  const job = await safeFetchJson<GreenhouseJob>(apiUrl);
  return mapGreenhouseJob(job);
}
