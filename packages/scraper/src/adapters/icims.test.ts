import { describe, expect, it } from "vitest";
import { extractDetailUrlsById, extractJobImpressions, icimsAdapter, isIcimsJobUrl, mapImpression } from "./icims";

const BASE_URL = "https://acme.icims.com/jobs/search";

// Shaped after the real `var jobImpressions = [...]` payload found on Western & Southern's
// live iCIMS board (see the icims.ts module doc comment for why this exists) — reproduced
// small rather than copy-pasted from the live fixture, since it's the shape that matters.
const IMPRESSIONS_HTML = `
<html><head></head><body>
<script type="text/javascript">
var jobImpressions = [{"positionType":"Full Time","location":{"city":"NEW YORK","state":"NY","country":"USA"},"id":"abc123","idRaw":100,"position":1,"title":"Software Engineer","category":"Engineering","postedDate":"2026-08-24"},{"positionType":"Intern","location":{"city":"CINCINNATI","state":"OH","country":"USA"},"id":"def456","idRaw":101,"position":2,"title":"Marketing Intern","category":"Marketing","postedDate":"2026-08-20"}];
</script>
<a href="/jobs/100/software-engineer/job"><span class="sr-only">Title</span> Software Engineer</a>
<a href="/jobs/101/marketing-intern/job"><span class="sr-only">Title</span> Marketing Intern</a>
</body></html>
`;

describe("extractJobImpressions", () => {
  it("parses the embedded jobImpressions array", () => {
    const impressions = extractJobImpressions(IMPRESSIONS_HTML);
    expect(impressions).toHaveLength(2);
    expect(impressions[0]).toMatchObject({ idRaw: 100, title: "Software Engineer" });
  });

  it("returns an empty array when the page has no jobImpressions variable at all", () => {
    expect(extractJobImpressions("<html><body>No jobs</body></html>")).toEqual([]);
  });

  it("returns an empty array for malformed JSON in the variable rather than throwing", () => {
    const html = `<script>var jobImpressions = [{ not valid json ];</script>`;
    expect(extractJobImpressions(html)).toEqual([]);
  });
});

describe("extractDetailUrlsById", () => {
  it("maps each numeric job id to its real detail-page URL", () => {
    const byId = extractDetailUrlsById(IMPRESSIONS_HTML, BASE_URL);
    expect(byId.get(100)).toBe("https://acme.icims.com/jobs/100/software-engineer/job");
    expect(byId.get(101)).toBe("https://acme.icims.com/jobs/101/marketing-intern/job");
  });

  it("returns an empty map when there are no /jobs/{id}/ links on the page", () => {
    expect(extractDetailUrlsById("<html></html>", BASE_URL).size).toBe(0);
  });
});

describe("mapImpression", () => {
  it("produces a clean title with no 'Title ' prefix artifact — the bug this adapter fixes", () => {
    const impression = {
      idRaw: 100,
      title: "Software Engineer",
      positionType: "Full Time",
      postedDate: "2026-08-24",
      location: { city: "NEW YORK", state: "NY" },
    };
    const posting = mapImpression(impression, "https://acme.icims.com/jobs/100/software-engineer/job");
    expect(posting.title).toBe("Software Engineer");
    expect(posting.title.toLowerCase().startsWith("title ")).toBe(false);
  });

  it("carries the exact postedDate through as a real Date — the field the generic tier never gets for this site", () => {
    const posting = mapImpression(
      { idRaw: 100, title: "Software Engineer", postedDate: "2026-08-24" },
      "https://acme.icims.com/jobs/100/software-engineer/job",
    );
    expect(posting.postedAt?.toISOString().slice(0, 10)).toBe("2026-08-24");
  });

  it("handles a missing postedDate/location without throwing", () => {
    const posting = mapImpression({ idRaw: 100, title: "Software Engineer" }, "https://acme.icims.com/jobs/100/x/job");
    expect(posting.postedAt).toBeNull();
    expect(posting.location).toBeNull();
    expect(posting.workMode).toBe("UNKNOWN");
  });

  it("maps positionType through the shared employment-type normalizer", () => {
    const posting = mapImpression(
      { idRaw: 100, title: "X", positionType: "Full Time" },
      "https://acme.icims.com/jobs/100/x/job",
    );
    expect(posting.employmentType).toBe("FULL_TIME");
  });
});

describe("isIcimsJobUrl", () => {
  it("accepts a real job detail URL (numeric id between /jobs/ and the next segment)", () => {
    expect(isIcimsJobUrl("https://acme.icims.com/jobs/25211/some-role/job")).toBe(true);
  });

  // These used to slip through the generic-tier fallback in fetchPostings as fake "postings"
  // (titled "Welcome page" / "Log back in!") — the bug this predicate fixes.
  it("rejects the page-chrome links a paginated results page also links to", () => {
    expect(isIcimsJobUrl("https://acme.icims.com/jobs/intro")).toBe(false);
    expect(isIcimsJobUrl("https://acme.icims.com/jobs/login?loginOnly=1")).toBe(false);
    expect(isIcimsJobUrl("https://acme.icims.com/jobs/search?pr=1")).toBe(false);
  });

  it("returns false rather than throwing for an unparseable URL", () => {
    expect(isIcimsJobUrl("not a url")).toBe(false);
  });
});

describe("icimsAdapter.matches", () => {
  it("matches any *.icims.com host", () => {
    expect(icimsAdapter.matches(new URL("https://careers-acme.icims.com/jobs/search"))).toBe(true);
  });

  it("does not match an unrelated host", () => {
    expect(icimsAdapter.matches(new URL("https://boards.greenhouse.io/acme"))).toBe(false);
  });
});
