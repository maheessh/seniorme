import * as cheerio from "cheerio";
import type { SourceType } from "@ccc/db";
import { extractAllJobPostingsJsonLd } from "../jsonld";
import { hashUrl, mapEmploymentType, mapWorkMode } from "../normalize";
import { isAllowedByRobots } from "../robots";
import { safeFetchText } from "../safe-fetch";
import type { RawJobPosting } from "../types";

const JOB_PATH_RE = /\/(?:jobs?|careers?|positions?|openings?)\/[a-z0-9][a-z0-9._-]{2,}/i;
const GENERIC_LINK_TEXT = new Set([
  "apply",
  "apply now",
  "learn more",
  "view",
  "view job",
  "view role",
  "see all",
  "see all jobs",
  "see more",
  "jobs",
  "careers",
  "home",
  "back",
  "next",
  "previous",
  "read more",
  "details",
]);

/** Below this many distinct candidate links, treat it as noise rather than a real listing. */
const MIN_HEURISTIC_MATCHES = 3;

function fromJsonLd(html: string, baseUrl: string): RawJobPosting[] {
  return extractAllJobPostingsJsonLd(html, baseUrl).map((posting) => ({
    externalJobId: posting.externalJobId ?? hashUrl(posting.url!).slice(0, 16),
    title: posting.title!,
    url: posting.url!,
    location: posting.location ?? null,
    workMode: posting.isRemote ? "REMOTE" : mapWorkMode(posting.location),
    employmentType: mapEmploymentType(posting.employmentType),
    description: posting.descriptionHtml ?? null,
    postedAt: posting.postedAt ? new Date(posting.postedAt) : null,
  }));
}

function fromHtmlHeuristic(html: string, baseUrl: string): RawJobPosting[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const seen = new Map<string, string>(); // url -> title

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      return;
    }
    if (absolute.hostname !== base.hostname) return;
    if (absolute.pathname === base.pathname) return;
    if (!JOB_PATH_RE.test(absolute.pathname)) return;

    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (!text || text.length < 4 || text.length > 150) return;
    if (GENERIC_LINK_TEXT.has(text.toLowerCase())) return;

    const url = absolute.toString();
    if (!seen.has(url)) seen.set(url, text);
  });

  if (seen.size < MIN_HEURISTIC_MATCHES) return [];

  return [...seen.entries()].map(([url, title]) => ({
    externalJobId: hashUrl(url).slice(0, 16),
    title,
    url,
    location: null,
    workMode: "UNKNOWN" as const,
    employmentType: null,
    description: null,
    postedAt: null,
  }));
}

export type GenericBoardResult = { postings: RawJobPosting[]; resolvedType: SourceType };

/**
 * Fallback tiers for career pages that aren't on a known ATS: first schema.org JobPosting
 * JSON-LD embedded directly on the listing page (higher confidence — common on simpler
 * custom-built sites, done for Google for Jobs SEO), then a conservative HTML-link heuristic
 * (lower confidence, requires several matching links to avoid false positives from nav/footer
 * links). Returns null if neither finds anything — most often because the page is rendered
 * client-side and has no extractable server-rendered content at all.
 */
export function extractGenericBoardPostings(html: string, baseUrl: string): GenericBoardResult | null {
  const jsonLdPostings = fromJsonLd(html, baseUrl);
  if (jsonLdPostings.length > 0) {
    return { postings: jsonLdPostings, resolvedType: "CUSTOM_JSONLD" };
  }

  const heuristicPostings = fromHtmlHeuristic(html, baseUrl);
  if (heuristicPostings.length > 0) {
    return { postings: heuristicPostings, resolvedType: "CUSTOM_HTML" };
  }

  return null;
}

/** Hard cap on how many pages a single scrape will follow, in case a site's pagination loops
 * or is unexpectedly deep — protects against runaway fetch chains against one host. */
const MAX_PAGES = 25;

/**
 * Finds the next page in a paginated listing via the standard `rel="next"` signal (either an
 * `<a rel="next">` in the page body or a `<link rel="next">` in the head — both are common,
 * unambiguous conventions, unlike guessing at "page=N+1" query params, which risks looping
 * forever or wandering off the listing entirely on a site that doesn't actually paginate that
 * way). Returns null if there's no next page, it points off-host, or it points back at the
 * current page (loop guard).
 */
export function findNextPageUrl(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html);
  const href = $('a[rel="next"], link[rel="next"]').first().attr("href");
  if (!href) return null;

  try {
    const current = new URL(currentUrl);
    const next = new URL(href, current);
    if (next.hostname !== current.hostname) return null;
    if (next.toString() === current.toString()) return null;
    return next.toString();
  } catch {
    return null;
  }
}

/**
 * Fetches and extracts a full generic board, following `rel="next"` pagination across pages
 * (many career boards — including ATS-agnostic ones like Waymo's Clinch-based site — paginate
 * listings at ~25-30 postings per page; fetching only the first page silently misses most of
 * the board). Each page goes through the same robots.txt + SSRF-safe fetch path as the first.
 */
export async function fetchGenericBoardWithPagination(sourceUrl: string): Promise<GenericBoardResult | null> {
  const postings: RawJobPosting[] = [];
  let resolvedType: SourceType | null = null;
  let currentUrl: string | null = sourceUrl;
  const visited = new Set<string>();

  for (let page = 0; page < MAX_PAGES && currentUrl && !visited.has(currentUrl); page++) {
    visited.add(currentUrl);

    if (page > 0 && !(await isAllowedByRobots(currentUrl))) break;

    let html: string;
    try {
      html = await safeFetchText(currentUrl);
    } catch (error) {
      // A later page failing outright (timeout, a transient block, a bot-detection challenge
      // response) shouldn't discard postings already found on earlier pages — that's strictly
      // worse than just stopping here with a partial result. Only a first-page failure should
      // fail the whole scrape (handled by the caller, which doesn't catch this rethrow).
      if (page === 0) throw error;
      break;
    }

    const result = extractGenericBoardPostings(html, currentUrl);

    if (!result) {
      if (page === 0) return null;
      break;
    }

    resolvedType = result.resolvedType;
    postings.push(...result.postings);
    currentUrl = findNextPageUrl(html, currentUrl);
  }

  if (!resolvedType) return null;
  return { postings, resolvedType };
}
