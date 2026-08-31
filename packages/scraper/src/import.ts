import type { EmploymentType, WorkMode } from "@ccc/db";
import { fetchSingleGreenhouseJob } from "./adapters/greenhouse";
import { fetchSingleLeverJob } from "./adapters/lever";
import { stripHtmlToText } from "./html-text";
import { extractJobPostingJsonLd } from "./jsonld";
import { extractJobWithLlm } from "./llm-extract";
import { mapEmploymentType, mapWorkMode } from "./normalize";
import { extractOpenGraph } from "./opengraph";
import { isAllowedByRobots } from "./robots";
import { safeFetchText } from "./safe-fetch";

export type ImportSource = "ats-api" | "json-ld" | "llm" | "opengraph" | "none";

export type ExtractedJobImport = {
  source: ImportSource;
  url: string;
  title: string | null;
  companyName: string | null;
  companyDomain: string | null;
  companyLogoUrl: string | null;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType | null;
  description: string | null;
  externalJobId: string | null;
  postedAt: Date | null;
  salaryMin: number | null;
  salaryMax: number | null;
  warning?: string;
};

function empty(url: string, source: ImportSource, warning?: string): ExtractedJobImport {
  return {
    source,
    url,
    title: null,
    companyName: null,
    companyDomain: null,
    companyLogoUrl: null,
    location: null,
    workMode: "UNKNOWN",
    employmentType: null,
    description: null,
    externalJobId: null,
    postedAt: null,
    salaryMin: null,
    salaryMax: null,
    warning,
  };
}

function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Tiered extraction for a single, user-supplied job URL — most-structured/reliable source
 * first, falling through to weaker signals, and finally to "nothing, fill in manually."
 * Never throws: every failure mode degrades to a lower tier or an empty result with a
 * human-readable `warning` explaining why.
 */
export async function extractJobFromUrl(rawUrl: string): Promise<ExtractedJobImport> {
  const url = new URL(rawUrl);

  const allowed = await isAllowedByRobots(rawUrl).catch(() => true);
  if (!allowed) {
    return empty(rawUrl, "none", "This site's robots.txt disallows fetching this page — fill in the details manually.");
  }

  // Tier 1: reuse the same ATS adapters used for career-page monitoring, when the URL is a
  // single-job link on a known ATS's own domain (not, e.g., a company's proxied careers page).
  try {
    const single = (await fetchSingleGreenhouseJob(url)) ?? (await fetchSingleLeverJob(url));
    if (single) {
      const slug = url.pathname.split("/").filter(Boolean)[0];
      return {
        source: "ats-api",
        url: single.url,
        title: single.title,
        companyName: slug ? titleCaseSlug(slug) : null,
        companyDomain: null,
        companyLogoUrl: null,
        location: single.location,
        workMode: single.workMode,
        employmentType: single.employmentType,
        description: single.description,
        externalJobId: single.externalJobId,
        postedAt: single.postedAt,
        salaryMin: null,
        salaryMax: null,
      };
    }
  } catch {
    // Fall through to the page-content tiers below.
  }

  let html: string;
  try {
    html = await safeFetchText(rawUrl);
  } catch (error) {
    return empty(
      rawUrl,
      "none",
      `Could not fetch this page: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Tier 2: schema.org JobPosting structured data (common — many ATS/company sites embed it
  // for Google for Jobs SEO — and far more reliable than free-text extraction).
  const jsonLd = extractJobPostingJsonLd(html);
  if (jsonLd?.title) {
    return {
      source: "json-ld",
      url: rawUrl,
      title: jsonLd.title,
      companyName: jsonLd.companyName ?? null,
      companyDomain: jsonLd.companyDomain ?? null,
      companyLogoUrl: jsonLd.companyLogoUrl ?? null,
      location: jsonLd.location ?? null,
      workMode: jsonLd.isRemote ? "REMOTE" : mapWorkMode(jsonLd.location),
      employmentType: mapEmploymentType(jsonLd.employmentType),
      description: jsonLd.descriptionHtml ?? null,
      externalJobId: jsonLd.externalJobId ?? null,
      postedAt: jsonLd.postedAt ? new Date(jsonLd.postedAt) : null,
      salaryMin: jsonLd.salaryMin ?? null,
      salaryMax: jsonLd.salaryMax ?? null,
    };
  }

  // Tier 3: Claude-assisted extraction from the page's visible text — only runs if
  // ANTHROPIC_API_KEY is configured; a missing key or any failure returns null.
  const llm = await extractJobWithLlm(stripHtmlToText(html));
  if (llm?.title) {
    return {
      source: "llm",
      url: rawUrl,
      title: llm.title,
      companyName: llm.companyName ?? null,
      companyDomain: null,
      companyLogoUrl: null,
      location: llm.location ?? null,
      workMode: llm.isRemote ? "REMOTE" : mapWorkMode(llm.location),
      employmentType: mapEmploymentType(llm.employmentType),
      description: llm.description ?? null,
      externalJobId: null,
      postedAt: llm.postedAt ? new Date(llm.postedAt) : null,
      salaryMin: llm.salaryMin ?? null,
      salaryMax: llm.salaryMax ?? null,
    };
  }

  // Tier 4 (weakest, but nearly free): OpenGraph tags give at least a title/short blurb on
  // most sites even when nothing else is available.
  const og = extractOpenGraph(html);
  if (og.title) {
    return {
      ...empty(rawUrl, "opengraph"),
      title: og.title,
      companyName: og.siteName ?? null,
      description: og.description ?? null,
      companyLogoUrl: og.image ?? null,
    };
  }

  return empty(rawUrl, "none", "Couldn't automatically extract job details from this page — fill them in manually.");
}
