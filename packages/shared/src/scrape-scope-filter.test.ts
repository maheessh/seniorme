import { describe, expect, it } from "vitest";
import { matchesScrapeScope, type ScrapeScopeCandidate } from "./scrape-scope-filter";

function candidate(overrides: Partial<ScrapeScopeCandidate> = {}): ScrapeScopeCandidate {
  return {
    title: "Software Engineer",
    location: "Seattle, WA, USA",
    postedAt: new Date(),
    ...overrides,
  };
}

const NO_FILTERS = { rolesOfInterest: [], targetLocationKeywords: [], maxPostingAgeDays: null };

describe("matchesScrapeScope — no filters set", () => {
  it("keeps everything when all three preferences are empty/null", () => {
    expect(matchesScrapeScope(candidate(), NO_FILTERS)).toBe(true);
    expect(matchesScrapeScope(candidate({ location: null }), NO_FILTERS)).toBe(true);
  });
});

describe("matchesScrapeScope — rolesOfInterest", () => {
  it("keeps a posting whose title contains one of the keywords (case-insensitive)", () => {
    const result = matchesScrapeScope(candidate({ title: "Senior software engineer, Backend" }), {
      ...NO_FILTERS,
      rolesOfInterest: ["Software Engineer"],
    });
    expect(result).toBe(true);
  });

  it("drops a posting matching none of the keywords", () => {
    const result = matchesScrapeScope(candidate({ title: "Warehouse Associate" }), {
      ...NO_FILTERS,
      rolesOfInterest: ["Software Engineer"],
    });
    expect(result).toBe(false);
  });

  it("is an OR across multiple keywords, not an AND", () => {
    const result = matchesScrapeScope(candidate({ title: "Product Manager" }), {
      ...NO_FILTERS,
      rolesOfInterest: ["Software Engineer", "Product Manager"],
    });
    expect(result).toBe(true);
  });
});

describe("matchesScrapeScope — targetLocationKeywords", () => {
  it("keeps a posting whose location contains one of the keywords", () => {
    const result = matchesScrapeScope(candidate({ location: "Seattle, WA, USA" }), {
      ...NO_FILTERS,
      targetLocationKeywords: ["Seattle"],
    });
    expect(result).toBe(true);
  });

  it("drops a posting whose location doesn't match", () => {
    const result = matchesScrapeScope(candidate({ location: "Austin, TX, USA" }), {
      ...NO_FILTERS,
      targetLocationKeywords: ["Seattle"],
    });
    expect(result).toBe(false);
  });

  it("drops a posting with no location data at all — can't confirm it matches", () => {
    const result = matchesScrapeScope(candidate({ location: null }), {
      ...NO_FILTERS,
      targetLocationKeywords: ["Seattle"],
    });
    expect(result).toBe(false);
  });

  it("matches 'Remote' as an ordinary keyword", () => {
    const result = matchesScrapeScope(candidate({ location: "Remote - US" }), {
      ...NO_FILTERS,
      targetLocationKeywords: ["Remote"],
    });
    expect(result).toBe(true);
  });
});

describe("matchesScrapeScope — maxPostingAgeDays", () => {
  it("keeps a posting newer than the cutoff", () => {
    const postedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    expect(matchesScrapeScope(candidate({ postedAt }), { ...NO_FILTERS, maxPostingAgeDays: 30 })).toBe(true);
  });

  it("drops a posting older than the cutoff", () => {
    const postedAt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    expect(matchesScrapeScope(candidate({ postedAt }), { ...NO_FILTERS, maxPostingAgeDays: 30 })).toBe(false);
  });

  it("keeps a posting with no known post date — unknown age is never evidence it's stale", () => {
    const result = matchesScrapeScope(candidate({ postedAt: null }), { ...NO_FILTERS, maxPostingAgeDays: 30 });
    expect(result).toBe(true);
  });
});

describe("matchesScrapeScope — combined", () => {
  it("requires all active filters to pass (AND across filter types)", () => {
    const filters = { rolesOfInterest: ["Software Engineer"], targetLocationKeywords: ["Seattle"], maxPostingAgeDays: 30 };

    expect(
      matchesScrapeScope(
        candidate({ title: "Software Engineer Intern", location: "Seattle, WA, USA", postedAt: new Date() }),
        filters,
      ),
    ).toBe(true);
    expect(matchesScrapeScope(candidate({ title: "Warehouse Associate" }), filters)).toBe(false);
    expect(matchesScrapeScope(candidate({ location: "Austin, TX, USA" }), filters)).toBe(false);
    expect(
      matchesScrapeScope(candidate({ postedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }), filters),
    ).toBe(false);
  });
});
