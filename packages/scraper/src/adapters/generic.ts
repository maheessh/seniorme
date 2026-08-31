import * as cheerio from "cheerio";
import type { SourceType } from "@ccc/db";
import { extractAllJobPostingsJsonLd } from "../jsonld";
import { hashUrl, mapEmploymentType, mapWorkMode } from "../normalize";
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
