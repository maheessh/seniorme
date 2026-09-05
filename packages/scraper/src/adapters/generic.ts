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

/**
 * "Seattle, WA" or "Seattle, WA, USA" — the common shape a location renders as its *own* short
 * text node near a job title (e.g. a `<li>City, ST</li>`). Anchored start-to-end deliberately:
 * matched against one isolated DOM text node at a time (see cardTextParts below), never a
 * concatenation of several — a substring search across joined text is exactly what let an
 * earlier version of this regex swallow "Container Service Locations Seattle, WA, USA" as if
 * all of it were the city name, since nothing stopped the greedy middle group from crossing
 * node boundaries once everything was one string.
 */
const LOCATION_RE = /^[A-Z][a-zA-Z.'\s-]{1,40},\s*[A-Z]{2}(?:,\s*[A-Za-z\s]{2,25})?$/;

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
  const seen = new Map<string, { title: string; location: string | null }>(); // url -> ...

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

    // A "clickable card" layout (common on component-library-built sites) wraps the whole card —
    // title, tags, location, a description snippet — in one anchor, so the anchor's full text is
    // way more than just a title. A heading inside it is almost always exactly the job title;
    // only fall back to the anchor's own text for the simpler case of a plain text link.
    const heading = $(el).find("h1, h2, h3, h4, h5, h6").first();
    const text = (heading.length > 0 ? heading.text() : $(el).text()).trim().replace(/\s+/g, " ");
    if (!text || text.length < 4 || text.length > 150) return;
    if (GENERIC_LINK_TEXT.has(text.toLowerCase())) return;

    // The opposite layout also shows up (e.g. Amazon's boards): the anchor wraps *only* the
    // title and sits *inside* a heading, with the location rendered as a sibling of that heading
    // rather than a descendant of the link — so it'd never be found by searching inside the
    // anchor itself (that's `heading` above, which looks for a heading *nested inside* the
    // anchor — the opposite relationship). `.closest()` walks up for an ANCESTOR heading instead;
    // its parent is the shared card container. Falls back to the anchor's own parent when
    // neither shape applies — for a "whole card is one big anchor" layout, everything (location
    // included) is already inside the anchor itself, so its parent still covers it.
    const ancestorHeading = $(el).closest("h1, h2, h3, h4, h5, h6");
    const cardScope = ancestorHeading.length > 0 ? ancestorHeading.parent() : $(el).parent();
    // Tested one DOM text node at a time, not concatenated — a location usually renders as its
    // own short, self-contained text node (e.g. a `<li>City, ST</li>`), and matching each node
    // individually against the fully-anchored LOCATION_RE means neighboring text (the title, a
    // "Locations" label, "Job ID: ...") can never bleed into the match the way a substring search
    // over one joined blob could.
    let location: string | null = null;
    cardScope
      .find("*")
      .addBack()
      .contents()
      .each((_, node) => {
        if (location || node.type !== "text" || !("data" in node)) return;
        const value = node.data.trim();
        if (LOCATION_RE.test(value)) location = value;
      });

    const url = absolute.toString();
    if (!seen.has(url)) seen.set(url, { title: text, location });
  });

  if (seen.size < MIN_HEURISTIC_MATCHES) return [];

  return [...seen.entries()].map(([url, { title, location }]) => ({
    externalJobId: hashUrl(url).slice(0, 16),
    title,
    url,
    location,
    workMode: mapWorkMode(location),
    employmentType: null,
    description: null,
    postedAt: null,
  }));
}

export type GenericPageResult = { postings: RawJobPosting[]; resolvedType: SourceType };
export type GenericBoardResult = GenericPageResult & {
  /** False if pagination stopped early instead of reaching a natural end — see AdapterFetchResult. */
  complete: boolean;
};

/**
 * Fallback tiers for career pages that aren't on a known ATS: first schema.org JobPosting
 * JSON-LD embedded directly on the listing page (higher confidence — common on simpler
 * custom-built sites, done for Google for Jobs SEO), then a conservative HTML-link heuristic
 * (lower confidence, requires several matching links to avoid false positives from nav/footer
 * links). Returns null if neither finds anything — most often because the page is rendered
 * client-side and has no extractable server-rendered content at all.
 */
export function extractGenericBoardPostings(html: string, baseUrl: string): GenericPageResult | null {
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

const NEXT_LINK_TEXT_RE = /^(?:next|next page|»|›|→|>|»»|next\s*»|next\s*›)$/i;

/**
 * A numbered pagination control ("1 2 3 ... 10") almost always marks its own page differently
 * from the rest — not a link at all (a <span>/<li>/<button>), or an <a> flagged with
 * `aria-current="page"` or an "active"/"current"/"selected" class — while every *other* page
 * number is a real, clickable `<a href>`. Scans for exactly that shape: a page number's OWN text
 * (not a descendant's — an `<li><a>2</a></li>` must not also count the `<li>` as a second "2"),
 * picks out whichever one is the current page, and returns the href of the next number up.
 * Returns null if there's no such cluster, or the "next" number has no real href to follow (e.g.
 * a JS-only pager with no navigable URL at all — nothing this can safely act on).
 */
function findNextNumberedPageUrl(
  $: ReturnType<typeof cheerio.load>,
  resolve: (href: string | undefined) => string | null,
): string | null {
  type Entry = { num: number; href: string | undefined; isCurrent: boolean };
  const entries: Entry[] = [];

  $("a, span, li, button").each((_, el) => {
    const $el = $(el);
    const ownText = $el.clone().children().remove().end().text().trim();
    if (!/^\d{1,4}$/.test(ownText)) return;

    const num = Number(ownText);
    const isLink = $el.is("a");
    const isCurrent =
      $el.attr("aria-current") === "page" ||
      /\b(active|current|selected)\b/i.test($el.attr("class") ?? "") ||
      !isLink; // a bare page number that isn't itself a link is almost always "you are here"
    const href = isLink ? $el.attr("href") : $el.find("a").attr("href");
    entries.push({ num, href, isCurrent });
  });

  // Need at least two distinct page numbers for this to mean anything — a single stray digit
  // elsewhere on the page (a count, a price, an ID) shouldn't be mistaken for pagination.
  const distinctNums = new Set(entries.map((e) => e.num));
  if (distinctNums.size < 2) return null;

  const current = entries.find((e) => e.isCurrent) ?? entries.reduce((a, b) => (a.num < b.num ? a : b));
  const next = entries.filter((e) => e.num > current.num).sort((a, b) => a.num - b.num)[0];
  return next ? resolve(next.href) : null;
}

/**
 * Finds the next page in a paginated listing. Tries three signals, most reliable first:
 * 1. `rel="next"` (an `<a rel="next">` in the body or a `<link rel="next">` in `<head>`) — the
 *    standard, unambiguous convention.
 * 2. A numbered pagination control ("1 2 3 ... 10") — see findNextNumberedPageUrl.
 * 3. A "Next"/"›"/"»" labeled link with a real `href`, for sites that render next/previous
 *    controls without the formal `rel="next"` attribute.
 * Returns null if none of these find anything, the target points off-host, or it points back at
 * the current page (loop guard) — deliberately never falls back to guessing at "page=N+1"-style
 * query params on its own, which risks looping forever or wandering off the listing entirely on
 * a site that doesn't actually paginate that way.
 */
export function findNextPageUrl(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html);
  const current = new URL(currentUrl);

  const resolve = (href: string | undefined): string | null => {
    if (!href) return null;
    try {
      const next = new URL(href, current);
      if (next.hostname !== current.hostname) return null;
      if (next.toString() === current.toString()) return null;
      return next.toString();
    } catch {
      return null;
    }
  };

  const viaRel = resolve($('a[rel="next"], link[rel="next"]').first().attr("href"));
  if (viaRel) return viaRel;

  const viaNumbered = findNextNumberedPageUrl($, resolve);
  if (viaNumbered) return viaNumbered;

  const viaNextText = resolve(
    $("a[href]")
      .filter((_, el) => NEXT_LINK_TEXT_RE.test($(el).text().trim()))
      .first()
      .attr("href"),
  );
  return viaNextText;
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
  // currentUrl is only null here because findNextPageUrl said there's no next page — a genuine
  // end of the listing. Any other exit (a later-page fetch/extraction failure, or hitting
  // MAX_PAGES) leaves it non-null, meaning postings may be missing pages that are still live.
  return { postings, resolvedType, complete: currentUrl === null };
}
