import type { RawJobPosting } from "@ccc/scraper";
import { describe, expect, it } from "vitest";
import { filterByCompanyPreferences } from "./scrape-processor";

function posting(overrides: Partial<RawJobPosting> = {}): RawJobPosting {
  return {
    externalJobId: "1",
    title: "Software Engineer",
    url: "https://example.com/jobs/1",
    location: "Seattle, WA, USA",
    workMode: "ONSITE",
    employmentType: "FULL_TIME",
    description: null,
    postedAt: new Date(),
    ...overrides,
  };
}

const NO_FILTERS = { rolesOfInterest: [], targetLocationKeywords: [], maxPostingAgeDays: null };

describe("filterByCompanyPreferences — no filters set", () => {
  it("keeps everything when all three preferences are empty/null", () => {
    const postings = [posting({ externalJobId: "1" }), posting({ externalJobId: "2", location: null })];
    expect(filterByCompanyPreferences(postings, NO_FILTERS)).toHaveLength(2);
  });
});

describe("filterByCompanyPreferences — rolesOfInterest", () => {
  it("keeps a posting whose title contains one of the keywords (case-insensitive)", () => {
    const postings = [posting({ title: "Senior software engineer, Backend" })];
    const result = filterByCompanyPreferences(postings, { ...NO_FILTERS, rolesOfInterest: ["Software Engineer"] });
    expect(result).toHaveLength(1);
  });

  it("drops a posting matching none of the keywords", () => {
    const postings = [posting({ title: "Warehouse Associate" })];
    const result = filterByCompanyPreferences(postings, { ...NO_FILTERS, rolesOfInterest: ["Software Engineer"] });
    expect(result).toHaveLength(0);
  });

  it("is an OR across multiple keywords, not an AND", () => {
    const postings = [posting({ title: "Product Manager" }), posting({ externalJobId: "2", title: "Recruiter" })];
    const result = filterByCompanyPreferences(postings, {
      ...NO_FILTERS,
      rolesOfInterest: ["Software Engineer", "Product Manager"],
    });
    expect(result.map((p) => p.title)).toEqual(["Product Manager"]);
  });
});

describe("filterByCompanyPreferences — targetLocationKeywords", () => {
  it("keeps a posting whose location contains one of the keywords", () => {
    const postings = [posting({ location: "Seattle, WA, USA" })];
    const result = filterByCompanyPreferences(postings, { ...NO_FILTERS, targetLocationKeywords: ["Seattle"] });
    expect(result).toHaveLength(1);
  });

  it("drops a posting whose location doesn't match", () => {
    const postings = [posting({ location: "Austin, TX, USA" })];
    const result = filterByCompanyPreferences(postings, { ...NO_FILTERS, targetLocationKeywords: ["Seattle"] });
    expect(result).toHaveLength(0);
  });

  it("drops a posting with no location data at all — can't confirm it matches", () => {
    const postings = [posting({ location: null })];
    const result = filterByCompanyPreferences(postings, { ...NO_FILTERS, targetLocationKeywords: ["Seattle"] });
    expect(result).toHaveLength(0);
  });

  it("matches 'Remote' as an ordinary keyword", () => {
    const postings = [posting({ location: "Remote - US" })];
    const result = filterByCompanyPreferences(postings, { ...NO_FILTERS, targetLocationKeywords: ["Remote"] });
    expect(result).toHaveLength(1);
  });
});

describe("filterByCompanyPreferences — maxPostingAgeDays", () => {
  it("keeps a posting newer than the cutoff", () => {
    const postedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const result = filterByCompanyPreferences([posting({ postedAt })], { ...NO_FILTERS, maxPostingAgeDays: 30 });
    expect(result).toHaveLength(1);
  });

  it("drops a posting older than the cutoff", () => {
    const postedAt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const result = filterByCompanyPreferences([posting({ postedAt })], { ...NO_FILTERS, maxPostingAgeDays: 30 });
    expect(result).toHaveLength(0);
  });

  it("keeps a posting with no known post date — unknown age is never evidence it's stale", () => {
    const result = filterByCompanyPreferences([posting({ postedAt: null })], { ...NO_FILTERS, maxPostingAgeDays: 30 });
    expect(result).toHaveLength(1);
  });
});

describe("filterByCompanyPreferences — combined", () => {
  it("requires all active filters to pass (AND across filter types)", () => {
    const matching = posting({
      externalJobId: "match",
      title: "Software Engineer Intern",
      location: "Seattle, WA, USA",
      postedAt: new Date(),
    });
    const wrongTitle = posting({
      externalJobId: "wrong-title",
      title: "Warehouse Associate",
      location: "Seattle, WA, USA",
      postedAt: new Date(),
    });
    const wrongLocation = posting({
      externalJobId: "wrong-location",
      title: "Software Engineer Intern",
      location: "Austin, TX, USA",
      postedAt: new Date(),
    });
    const tooOld = posting({
      externalJobId: "too-old",
      title: "Software Engineer Intern",
      location: "Seattle, WA, USA",
      postedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });

    const result = filterByCompanyPreferences([matching, wrongTitle, wrongLocation, tooOld], {
      rolesOfInterest: ["Software Engineer"],
      targetLocationKeywords: ["Seattle"],
      maxPostingAgeDays: 30,
    });

    expect(result.map((p) => p.externalJobId)).toEqual(["match"]);
  });
});
