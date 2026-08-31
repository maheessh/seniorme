import { safeFetchJson } from "../safe-fetch";
import { extractSlug, mapEmploymentType, mapWorkMode } from "../normalize";
import type { CareerSiteAdapter, RawJobPosting } from "../types";

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number;
  categories?: { location?: string; commitment?: string };
  workplaceType?: string;
  descriptionPlain?: string;
};

function mapLeverPosting(posting: LeverPosting): RawJobPosting {
  return {
    externalJobId: posting.id,
    title: posting.text,
    url: posting.hostedUrl,
    location: posting.categories?.location ?? null,
    workMode: mapWorkMode(posting.workplaceType ?? posting.categories?.location),
    employmentType: mapEmploymentType(posting.categories?.commitment),
    description: posting.descriptionPlain ?? null,
    postedAt: posting.createdAt ? new Date(posting.createdAt) : null,
  };
}

// Verified against Lever's public demo board (api.lever.co/v0/postings/leverdemo) during
// implementation.
export const leverAdapter: CareerSiteAdapter = {
  type: "LEVER",
  matches(url) {
    return /(^|\.)lever\.co$/i.test(url.hostname);
  },
  async fetchPostings(sourceUrl) {
    const company = extractSlug(sourceUrl);
    if (!company) {
      throw new Error(`Could not determine the Lever company slug from ${sourceUrl}`);
    }

    const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
    const data = await safeFetchJson<LeverPosting[]>(apiUrl);

    return { postings: data.map(mapLeverPosting) };
  },
};

export function parseLeverJobUrl(url: URL): { company: string; postingId: string } | null {
  if (!/(^|\.)lever\.co$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/([^/]+)\/([0-9a-f-]{20,})/i);
  if (!match) return null;
  return { company: match[1], postingId: match[2] };
}

export async function fetchSingleLeverJob(url: URL): Promise<RawJobPosting | null> {
  const parsed = parseLeverJobUrl(url);
  if (!parsed) return null;

  const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(parsed.company)}/${encodeURIComponent(parsed.postingId)}?mode=json`;
  const posting = await safeFetchJson<LeverPosting>(apiUrl);
  return mapLeverPosting(posting);
}
