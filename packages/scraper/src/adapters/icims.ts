import * as cheerio from "cheerio";
import { isAllowedByRobots } from "../robots";
import { safeFetchText } from "../safe-fetch";
import { mapEmploymentType, mapWorkMode } from "../normalize";
import type { CareerSiteAdapter, RawJobPosting } from "../types";
import { findNextPageUrl } from "./generic";

const MAX_PAGES = 25;

export type JobImpression = {
  idRaw: number;
  title: string;
  positionType?: string | null;
  postedDate?: string | null;
  location?: { city?: string | null; state?: string | null; country?: string | null } | null;
};

/**
 * iCIMS search-results pages embed a `var jobImpressions = [...]` array — analytics tracking
 * data, not meant as an API, but far more reliable than the generic HTML-link heuristic: clean
 * titles (the visible links wrap the title in a screen-reader "Title" label that the plain-text
 * heuristic picks up verbatim, producing "Title Software Engineer") and an exact postedDate the
 * listing page otherwise doesn't expose at all. Cross-referenced against the real job-detail
 * hrefs on the same page (both carry the same numeric id) to get a real URL rather than
 * constructing one from a guessed slug format.
 */
export function extractJobImpressions(html: string): JobImpression[] {
  const match = html.match(/var\s+jobImpressions\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as JobImpression[];
  } catch {
    return [];
  }
}

export function extractDetailUrlsById(html: string, baseUrl: string): Map<number, string> {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const byId = new Map<number, string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      return;
    }
    const match = absolute.pathname.match(/\/jobs\/(\d+)\//);
    if (match) byId.set(Number(match[1]), absolute.toString());
  });

  return byId;
}

export function mapImpression(impression: JobImpression, url: string): RawJobPosting {
  const location = impression.location
    ? [impression.location.city, impression.location.state].filter(Boolean).join(", ")
    : null;

  return {
    externalJobId: String(impression.idRaw),
    title: impression.title.trim(),
    url,
    location,
    workMode: mapWorkMode(location),
    employmentType: mapEmploymentType(impression.positionType),
    description: null,
    postedAt: impression.postedDate ? new Date(impression.postedDate) : null,
  };
}

export const icimsAdapter: CareerSiteAdapter = {
  type: "ICIMS",
  matches(url) {
    return /(^|\.)icims\.com$/i.test(url.hostname);
  },
  async fetchPostings(sourceUrl) {
    const postings: RawJobPosting[] = [];
    let currentUrl: string | null = sourceUrl;
    const visited = new Set<string>();

    for (let page = 0; page < MAX_PAGES && currentUrl && !visited.has(currentUrl); page++) {
      visited.add(currentUrl);

      if (page > 0 && !(await isAllowedByRobots(currentUrl))) break;

      let html: string;
      try {
        html = await safeFetchText(currentUrl);
      } catch (error) {
        if (page === 0) throw error;
        break;
      }

      const impressions = extractJobImpressions(html);
      if (impressions.length === 0) {
        if (page === 0) {
          throw new Error("Couldn't find the expected job listing data on this iCIMS page.");
        }
        break;
      }

      const urlsById = extractDetailUrlsById(html, currentUrl);
      for (const impression of impressions) {
        const url = urlsById.get(impression.idRaw);
        // Skip entries with no matching detail link rather than guessing a URL — a wrong link
        // is worse than a missing posting, which the next page/run can still pick up.
        if (url) postings.push(mapImpression(impression, url));
      }

      currentUrl = findNextPageUrl(html, currentUrl);
    }

    // currentUrl is only null here because findNextPageUrl said there's no next page — see the
    // equivalent comment in fetchGenericBoardWithPagination for the failure/MAX_PAGES cases.
    return { postings, complete: currentUrl === null };
  },
};
