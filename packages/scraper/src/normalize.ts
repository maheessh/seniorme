import { createHash } from "node:crypto";
import type { SourceType, WorkMode } from "@ccc/db";

const TRACKING_PARAM_PREFIXES = ["utm_", "gh_", "lever-", "ref", "source"];

/** Normalizes a job URL so re-fetching the same posting hashes to the same value. */
export function canonicalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAM_PREFIXES.some((prefix) => key.toLowerCase().startsWith(prefix))) {
      params.delete(key);
    }
  }
  const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)));
  url.search = sorted.toString();

  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  url.pathname = pathname;

  return url.toString();
}

export function hashUrl(rawUrl: string): string {
  return createHash("sha256").update(canonicalizeUrl(rawUrl)).digest("hex");
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex");
}

const SOURCE_TYPE_BY_HOST: Array<[RegExp, SourceType]> = [
  [/(^|\.)greenhouse\.io$/i, "GREENHOUSE"],
  [/(^|\.)lever\.co$/i, "LEVER"],
  [/(^|\.)ashbyhq\.com$/i, "ASHBY"],
  [/(^|\.)smartrecruiters\.com$/i, "SMARTRECRUITERS"],
  [/(^|\.)myworkdayjobs\.com$/i, "WORKDAY"],
];

export function detectSourceType(rawUrl: string): SourceType {
  const hostname = new URL(rawUrl).hostname;
  for (const [pattern, type] of SOURCE_TYPE_BY_HOST) {
    if (pattern.test(hostname)) return type;
  }
  return "CUSTOM_HTML";
}

/** The first path segment is the org/board slug for Greenhouse, Lever, and Ashby URLs alike. */
export function extractSlug(rawUrl: string): string | null {
  const segments = new URL(rawUrl).pathname.split("/").filter(Boolean);
  return segments[0] ?? null;
}

export function mapWorkMode(value: string | null | undefined): WorkMode {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("remote")) return "REMOTE";
  if (normalized.includes("hybrid")) return "HYBRID";
  if (normalized.includes("onsite") || normalized.includes("on-site") || normalized.includes("office")) {
    return "ONSITE";
  }
  return "UNKNOWN";
}

export function mapEmploymentType(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("intern")) return "INTERNSHIP" as const;
  if (normalized.includes("contract") || normalized.includes("temporary")) return "CONTRACT" as const;
  if (normalized.includes("new grad") || normalized.includes("new-grad")) return "NEW_GRAD" as const;
  if (normalized.includes("full") || normalized.includes("regular")) return "FULL_TIME" as const;
  return null;
}
