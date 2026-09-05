import type { SourceType } from "@ccc/db";
import { chromium } from "playwright";
import { isAllowedByRobots } from "../robots";
import { assertPublicHost } from "../safe-fetch";
import type { RawJobPosting } from "../types";
import { extractGenericBoardPostings, findNextPageUrl, type GenericBoardResult } from "./generic";

const USER_AGENT =
  "CareerCommandCenterBot/0.1 (+personal job-search tracker; single-user, respects robots.txt)";
const NAV_TIMEOUT_MS = 20_000;
/** Extra time after the page settles for client-side rendering (React/Angular hydration, an
 * XHR-driven job list) to actually paint — `networkidle` alone fires the instant requests stop,
 * which can be before the response is rendered into the DOM. */
const RENDER_SETTLE_MS = 2_000;
/** Lower than the static-fetch tier's 25 — each "page" here is a real browser navigation
 * (seconds, not milliseconds), so the worst case needs a tighter bound. Most real boards that
 * fall back this far are well under this anyway. */
const MAX_PAGES = 10;

/**
 * Last-resort tier for career pages that render their listings entirely client-side — no known
 * ATS, no JSON-LD, no job links in the server-rendered HTML for the static-fetch tiers
 * (generic.ts) to find. Loads the page in a real headless browser and re-runs the same JSON-LD/
 * HTML-link extraction against the fully rendered DOM instead — then follows the same
 * rel="next"/numbered-pagination/"Next"-link detection generic.ts's static-fetch tier uses,
 * re-rendering each subsequent page the same way, so a site that needs headless rendering *and*
 * paginates across several pages isn't silently cut off at the first one.
 *
 * A real browser will happily fetch whatever the page tells it to — including an internal
 * address, if the page (or something injected into it) asks — so every sub-request it makes is
 * checked against the same SSRF guard as safeFetch before being allowed through; nothing here
 * relies on the target URL having been pre-validated by the caller.
 *
 * Doesn't drive a JS-only "Load more" button (a click-to-append pattern with no navigable URL at
 * all, as opposed to a real link-based next page) — `findNextPageUrl` only ever returns a real
 * `href`, so a button-only pager simply isn't detected, and `complete` stays conservative (see
 * below) rather than silently wrong.
 */
export async function fetchWithHeadlessBrowser(sourceUrl: string): Promise<GenericBoardResult | null> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    // Deliberately doesn't block any resource type (images/fonts/stylesheets) to save time —
    // some sites' virtualized job lists only render cards their layout engine considers "in
    // view," which depends on real CSS being loaded; blocking stylesheets silently zeroed out
    // the entire list on one real board tested during development.
    await context.route("**/*", async (route) => {
      const request = route.request();
      let hostname: string;
      try {
        hostname = new URL(request.url()).hostname;
      } catch {
        await route.continue(); // data:/blob: and similar — no network reach, nothing to guard
        return;
      }

      try {
        await assertPublicHost(hostname);
        await route.continue();
      } catch {
        await route.abort();
      }
    });

    const postings: RawJobPosting[] = [];
    let resolvedType: SourceType | null = null;
    let currentUrl: string | null = sourceUrl;
    // Only meaningful once we've actually found and followed a real pagination signal — a site
    // with no pagination at all (genuinely one page) and a site whose pager we can't act on (a
    // JS-only "Load more" button, no href) both leave this false, and both should stay
    // conservative about `complete` rather than assume "no next link" means "no more jobs".
    let foundAnyPagination = false;
    const visited = new Set<string>();

    for (let pageNum = 0; pageNum < MAX_PAGES && currentUrl && !visited.has(currentUrl); pageNum++) {
      visited.add(currentUrl);

      if (pageNum > 0 && !(await isAllowedByRobots(currentUrl))) break;

      await page
        .goto(currentUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS })
        .catch(() => {
          // "networkidle" can time out on pages with an analytics/tracking connection that never
          // goes quiet — the job listing has usually rendered long before then, so fall through
          // to extraction rather than failing the whole scrape over an unrelated background
          // request.
        });
      await page.waitForTimeout(RENDER_SETTLE_MS);

      const html = await page.content();
      const result = extractGenericBoardPostings(html, page.url());
      if (!result) {
        if (pageNum === 0) return null;
        break;
      }

      resolvedType = result.resolvedType;
      postings.push(...result.postings);

      const next = findNextPageUrl(html, page.url());
      if (next) foundAnyPagination = true;
      currentUrl = next;
    }

    if (!resolvedType) return null;
    return { postings, resolvedType, complete: foundAnyPagination && currentUrl === null };
  } finally {
    await browser.close();
  }
}
