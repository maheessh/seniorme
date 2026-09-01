import { chromium } from "playwright";
import { assertPublicHost } from "../safe-fetch";
import { extractGenericBoardPostings, type GenericBoardResult } from "./generic";

const USER_AGENT =
  "CareerCommandCenterBot/0.1 (+personal job-search tracker; single-user, respects robots.txt)";
const NAV_TIMEOUT_MS = 20_000;
/** Extra time after the page settles for client-side rendering (React/Angular hydration, an
 * XHR-driven job list) to actually paint — `networkidle` alone fires the instant requests stop,
 * which can be before the response is rendered into the DOM. */
const RENDER_SETTLE_MS = 2_000;

/**
 * Last-resort tier for career pages that render their listings entirely client-side — no known
 * ATS, no JSON-LD, no job links in the server-rendered HTML for the static-fetch tiers
 * (generic.ts) to find. Loads the page in a real headless browser and re-runs the same JSON-LD/
 * HTML-link extraction against the fully rendered DOM instead.
 *
 * A real browser will happily fetch whatever the page tells it to — including an internal
 * address, if the page (or something injected into it) asks — so every sub-request it makes is
 * checked against the same SSRF guard as safeFetch before being allowed through; nothing here
 * relies on the target URL having been pre-validated by the caller.
 *
 * Doesn't drive JS-only pagination (e.g. clicking a "next page" control) — this only ever
 * captures what's visible after the initial render. Callers must not treat that as a complete
 * listing (see AdapterFetchResult.complete) since postings beyond the first page would
 * otherwise be wrongly flagged as removed.
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

    await page
      .goto(sourceUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS })
      .catch(() => {
        // "networkidle" can time out on pages with an analytics/tracking connection that never
        // goes quiet — the job listing has usually rendered long before then, so fall through to
        // extraction rather than failing the whole scrape over an unrelated background request.
      });
    await page.waitForTimeout(RENDER_SETTLE_MS);

    const html = await page.content();
    const result = extractGenericBoardPostings(html, page.url());
    if (!result) return null;

    return { ...result, complete: false };
  } finally {
    await browser.close();
  }
}
