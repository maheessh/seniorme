import { describe, expect, it } from "vitest";
import { extractAllJobPostingsJsonLd, extractJobPostingJsonLd } from "./jsonld";

function scriptTag(payload: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

const BASE_POSTING = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Software Engineer",
  url: "https://example.com/jobs/1",
  description: "<p>Build things</p>",
  datePosted: "2026-08-01",
  hiringOrganization: { name: "Acme", sameAs: "https://www.acme.com", logo: "https://acme.com/logo.png" },
  jobLocation: { address: { addressLocality: "San Francisco", addressRegion: "CA", addressCountry: "US" } },
  employmentType: "FULL_TIME",
  baseSalary: { value: { minValue: 120000, maxValue: 160000 } },
};

describe("extractJobPostingJsonLd (single-job page)", () => {
  it("maps a well-formed JobPosting node", () => {
    const html = `<html><head>${scriptTag(BASE_POSTING)}</head></html>`;
    const result = extractJobPostingJsonLd(html);
    expect(result).toMatchObject({
      title: "Software Engineer",
      url: "https://example.com/jobs/1",
      location: "San Francisco, CA, US",
      companyName: "Acme",
      companyDomain: "acme.com",
      employmentType: "FULL_TIME",
      salaryMin: 120000,
      salaryMax: 160000,
    });
  });

  it("returns null when there's no JobPosting script at all — never throws", () => {
    expect(extractJobPostingJsonLd("<html><body>No jobs here</body></html>")).toBeNull();
  });

  it("returns null for malformed JSON rather than crashing the whole scrape", () => {
    const html = `<script type="application/ld+json">{ not valid json </script>`;
    expect(extractJobPostingJsonLd(html)).toBeNull();
  });

  it("finds a JobPosting nested inside a @graph array", () => {
    const html = scriptTag({ "@graph": [{ "@type": "Organization" }, BASE_POSTING] });
    expect(extractJobPostingJsonLd(html)?.title).toBe("Software Engineer");
  });

  it("finds a JobPosting when @type is an array of types", () => {
    const posting = { ...BASE_POSTING, "@type": ["JobPosting", "Thing"] };
    expect(extractJobPostingJsonLd(scriptTag(posting))?.title).toBe("Software Engineer");
  });

  it("handles missing optional metadata (no salary, no location) without throwing", () => {
    const minimal = { "@type": "JobPosting", title: "Bare Posting", url: "https://example.com/jobs/2" };
    const result = extractJobPostingJsonLd(scriptTag(minimal));
    expect(result).toMatchObject({ title: "Bare Posting", salaryMin: undefined, location: undefined });
  });
});

describe("extractAllJobPostingsJsonLd (listing page)", () => {
  it("extracts every JobPosting on the page", () => {
    const html = [
      scriptTag(BASE_POSTING),
      scriptTag({ ...BASE_POSTING, title: "Data Scientist", url: "https://example.com/jobs/2" }),
    ].join("\n");
    const postings = extractAllJobPostingsJsonLd(html, "https://example.com/jobs");
    expect(postings.map((p) => p.title)).toEqual(["Software Engineer", "Data Scientist"]);
  });

  it("resolves a relative posting URL against the listing page's URL", () => {
    const posting = { ...BASE_POSTING, url: "/jobs/1" };
    const [result] = extractAllJobPostingsJsonLd(scriptTag(posting), "https://example.com/careers");
    expect(result.url).toBe("https://example.com/jobs/1");
  });

  it("drops a posting with no title — can't be shown or deduped meaningfully", () => {
    const noTitle = { ...BASE_POSTING, title: undefined };
    expect(extractAllJobPostingsJsonLd(scriptTag(noTitle), "https://example.com")).toHaveLength(0);
  });

  it("drops a posting with no resolvable URL — dedup and linking both need it", () => {
    const noUrl = { ...BASE_POSTING, url: undefined };
    expect(extractAllJobPostingsJsonLd(scriptTag(noUrl), "https://example.com")).toHaveLength(0);
  });

  it("skips a script block that isn't valid JSON without dropping the postings around it", () => {
    const html = [
      scriptTag(BASE_POSTING),
      `<script type="application/ld+json">{ broken </script>`,
      scriptTag({ ...BASE_POSTING, title: "Data Scientist", url: "https://example.com/jobs/2" }),
    ].join("\n");
    const postings = extractAllJobPostingsJsonLd(html, "https://example.com");
    expect(postings).toHaveLength(2);
  });

  it("returns an empty array for a page with no JobPosting data, not null", () => {
    expect(extractAllJobPostingsJsonLd("<html></html>", "https://example.com")).toEqual([]);
  });

  it("marks isRemote from jobLocationType TELECOMMUTE", () => {
    const remote = { ...BASE_POSTING, jobLocationType: "TELECOMMUTE" };
    const [result] = extractAllJobPostingsJsonLd(scriptTag(remote), "https://example.com");
    expect(result.isRemote).toBe(true);
  });
});
