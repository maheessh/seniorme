import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  detectSourceType,
  extractSlug,
  hashContent,
  hashUrl,
  mapEmploymentType,
  mapWorkMode,
} from "./normalize";

describe("canonicalizeUrl", () => {
  it("strips the fragment", () => {
    expect(canonicalizeUrl("https://example.com/jobs/1#apply")).toBe("https://example.com/jobs/1");
  });

  it("lowercases the hostname but not the path", () => {
    expect(canonicalizeUrl("https://EXAMPLE.com/Jobs/AbC")).toBe("https://example.com/Jobs/AbC");
  });

  it("drops a trailing slash", () => {
    expect(canonicalizeUrl("https://example.com/jobs/1/")).toBe("https://example.com/jobs/1");
  });

  it("never strips the root path down to nothing", () => {
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("strips known tracking params but keeps real query params", () => {
    const url = canonicalizeUrl("https://example.com/jobs?utm_source=li&gh_jid=1&department=eng");
    expect(url).toBe("https://example.com/jobs?department=eng");
  });

  it("sorts remaining query params for a stable hash regardless of original order", () => {
    const a = canonicalizeUrl("https://example.com/jobs?b=2&a=1");
    const b = canonicalizeUrl("https://example.com/jobs?a=1&b=2");
    expect(a).toBe(b);
  });
});

describe("hashUrl", () => {
  it("is a pure function of the canonical URL — same job, different tracking params, same hash", () => {
    const a = hashUrl("https://example.com/jobs/1?utm_source=twitter");
    const b = hashUrl("https://example.com/jobs/1?utm_source=linkedin");
    expect(a).toBe(b);
  });

  it("changed URL (even same posting) produces a different hash — dedup relies on this being exact", () => {
    const a = hashUrl("https://example.com/jobs/1");
    const b = hashUrl("https://example.com/jobs/2");
    expect(a).not.toBe(b);
  });

  it("produces a 64-char hex sha256 digest", () => {
    expect(hashUrl("https://example.com/jobs/1")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hashContent", () => {
  it("ignores leading/trailing whitespace", () => {
    expect(hashContent("  same text  ")).toBe(hashContent("same text"));
  });

  it("changes when the content changes — drives the 'description updated' re-scrape path", () => {
    expect(hashContent("v1")).not.toBe(hashContent("v2"));
  });
});

describe("detectSourceType", () => {
  it.each([
    ["https://boards.greenhouse.io/acme", "GREENHOUSE"],
    ["https://jobs.lever.co/acme", "LEVER"],
    ["https://jobs.ashbyhq.com/acme", "ASHBY"],
    ["https://acme.icims.com/jobs/search", "ICIMS"],
    ["https://careers.smartrecruiters.com/acme", "SMARTRECRUITERS"],
    ["https://acme.myworkdayjobs.com/careers", "WORKDAY"],
  ])("maps %s to %s", (url, expected) => {
    expect(detectSourceType(url)).toBe(expected);
  });

  it("falls back to CUSTOM_HTML for an unrecognized host rather than guessing", () => {
    expect(detectSourceType("https://careers.example.com/jobs")).toBe("CUSTOM_HTML");
  });

  it("doesn't false-positive on a host that merely contains an ATS name as a substring", () => {
    expect(detectSourceType("https://notgreenhouse.io/jobs")).toBe("CUSTOM_HTML");
  });
});

describe("extractSlug", () => {
  it("takes the first path segment", () => {
    expect(extractSlug("https://boards.greenhouse.io/acme/jobs/123")).toBe("acme");
  });

  it("returns null for a URL with no path segments", () => {
    expect(extractSlug("https://boards.greenhouse.io/")).toBeNull();
  });
});

describe("mapWorkMode", () => {
  it.each([
    ["Remote", "REMOTE"],
    ["Fully remote (US)", "REMOTE"],
    ["Hybrid - 3 days/week", "HYBRID"],
    ["On-site", "ONSITE"],
    ["Onsite", "ONSITE"],
    ["Mountain View Office", "ONSITE"],
  ])("maps %s to %s", (input, expected) => {
    expect(mapWorkMode(input)).toBe(expected);
  });

  it("defaults to UNKNOWN rather than guessing for an unrecognized string", () => {
    expect(mapWorkMode("San Francisco, CA")).toBe("UNKNOWN");
  });

  it("defaults to UNKNOWN for missing metadata (null/undefined) instead of throwing", () => {
    expect(mapWorkMode(null)).toBe("UNKNOWN");
    expect(mapWorkMode(undefined)).toBe("UNKNOWN");
  });
});

describe("mapEmploymentType", () => {
  it.each([
    ["Internship", "INTERNSHIP"],
    ["Contract", "CONTRACT"],
    ["Temporary", "CONTRACT"],
    ["New Grad", "NEW_GRAD"],
    ["Full Time", "FULL_TIME"],
    ["Regular", "FULL_TIME"],
  ])("maps %s to %s", (input, expected) => {
    expect(mapEmploymentType(input)).toBe(expected);
  });

  it("returns null for missing/unrecognized metadata rather than throwing", () => {
    expect(mapEmploymentType(null)).toBeNull();
    expect(mapEmploymentType(undefined)).toBeNull();
    expect(mapEmploymentType("Freelance")).toBeNull();
  });
});
