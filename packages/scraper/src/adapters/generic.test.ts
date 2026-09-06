import { describe, expect, it } from "vitest";
import { extractGenericBoardPostings, findNextPageUrl } from "./generic";

function jobPostingLd(title: string, url: string) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@type": "JobPosting",
    title,
    url,
    datePosted: "2026-08-01",
  })}</script>`;
}

const BASE_URL = "https://careers.example.com/jobs/search";

describe("extractGenericBoardPostings — JSON-LD tier", () => {
  it("prefers JSON-LD over the HTML heuristic when both could apply", () => {
    const html = [
      jobPostingLd("Engineer", "https://careers.example.com/jobs/1"),
      `<a href="/jobs/other-role-x">Other Role</a>`,
      `<a href="/jobs/other-role-y">Other Role Y</a>`,
      `<a href="/jobs/other-role-z">Other Role Z</a>`,
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.resolvedType).toBe("CUSTOM_JSONLD");
    expect(result?.postings).toHaveLength(1);
  });
});

describe("extractGenericBoardPostings — HTML-link heuristic tier", () => {
  it("extracts job links matching a job-ish path, once there are enough of them", () => {
    const html = [
      `<a href="/jobs/software-engineer-abc">Software Engineer</a>`,
      `<a href="/jobs/data-scientist-def">Data Scientist</a>`,
      `<a href="/jobs/product-manager-ghi">Product Manager</a>`,
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.resolvedType).toBe("CUSTOM_HTML");
    expect(result?.postings.map((p) => p.title)).toEqual([
      "Software Engineer",
      "Data Scientist",
      "Product Manager",
    ]);
  });

  it("recognizes 'role'/'vacancy'/'opportunity'-style path vocabulary, not just job/career/position/opening", () => {
    // Real regression: Zipline's board uses /open-roles/<id> — "open-roles" never appears as an
    // exact "/jobs/", "/careers/", "/positions/", or "/openings/" segment, so every link on the
    // page was silently rejected and the whole source failed with "no job postings found" despite
    // 10+ real, linkable postings being right there in the rendered HTML.
    const html = [
      `<a href="/open-roles/7895360003">Account Executive</a>`,
      `<a href="/open-vacancies/200456">Data Scientist</a>`,
      `<a href="/current-opportunities/300789">Product Manager</a>`,
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.postings.map((p) => p.title)).toEqual([
      "Account Executive",
      "Data Scientist",
      "Product Manager",
    ]);
  });

  it("returns null (not an empty result) below the minimum-match threshold — noise, not a real listing", () => {
    const html = [
      `<a href="/jobs/software-engineer-abc">Software Engineer</a>`,
      `<a href="/jobs/data-scientist-def">Data Scientist</a>`,
    ].join("\n");
    expect(extractGenericBoardPostings(html, BASE_URL)).toBeNull();
  });

  it("filters out generic nav/footer link text like 'Apply' or 'Learn more'", () => {
    const html = [
      `<a href="/jobs/software-engineer-abc">Apply</a>`,
      `<a href="/jobs/data-scientist-def">Data Scientist</a>`,
      `<a href="/jobs/product-manager-ghi">Product Manager</a>`,
      `<a href="/jobs/backend-engineer-jkl">Backend Engineer</a>`,
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.postings).toHaveLength(3);
  });

  it("ignores links to a different hostname", () => {
    const html = [
      `<a href="https://other.com/jobs/software-engineer-abc">Software Engineer</a>`,
      `<a href="/jobs/data-scientist-def">Data Scientist</a>`,
      `<a href="/jobs/product-manager-ghi">Product Manager</a>`,
      `<a href="/jobs/backend-engineer-jkl">Backend Engineer</a>`,
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.postings).toHaveLength(3);
  });

  it("ignores a self-referential link back to the listing page itself (pagination/filter links)", () => {
    const html = [
      `<a href="/jobs/search?page=2">Software Engineer</a>`,
      `<a href="/jobs/data-scientist-def">Data Scientist</a>`,
      `<a href="/jobs/product-manager-ghi">Product Manager</a>`,
      `<a href="/jobs/backend-engineer-jkl">Backend Engineer</a>`,
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.postings).toHaveLength(3);
  });

  it("uses a nested heading as the title for a 'clickable card' link wrapping title+tags+description", () => {
    // Common on component-library-built sites: the whole card (title, tags, a description
    // snippet) sits inside one <a>, so the anchor's own full text is way more than a title.
    const card = (path: string, title: string) =>
      `<a href="${path}"><div><h2>${title}</h2><span>Full Time</span>` +
      `<p>${"Lorem ipsum dolor sit amet, a much longer description snippet than any real title. ".repeat(2)}</p>` +
      `</div></a>`;
    const html = [
      card("/jobs/software-engineer-abc", "Software Engineer"),
      card("/jobs/data-scientist-def", "Data Scientist"),
      card("/jobs/product-manager-ghi", "Product Manager"),
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.postings.map((p) => p.title)).toEqual(["Software Engineer", "Data Scientist", "Product Manager"]);
  });

  it("extracts a sibling location for the opposite layout — anchor inside a heading, not wrapping one", () => {
    // Amazon's own board (verified live): the anchor wraps *only* the title and sits inside an
    // <h3>; the location renders as a sibling <li> of that heading, not a descendant of the link.
    const card = (path: string, title: string, location: string) =>
      `<div class="card"><h3><a href="${path}">${title}</a></h3>` +
      `<ul><li>${location}</li><li>|</li><li>Job ID: 123</li></ul></div>`;
    const html = [
      card("/jobs/10530555/software-dev-engineer", "Software Dev Engineer", "Seattle, WA, USA"),
      card("/jobs/10530584/wireless-tpm", "Wireless TPM", "Sunnyvale, CA, USA"),
      card("/jobs/10530581/business-process-manager", "Business Process Manager", "Bellevue, WA, USA"),
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.postings.map((p) => p.location)).toEqual([
      "Seattle, WA, USA",
      "Sunnyvale, CA, USA",
      "Bellevue, WA, USA",
    ]);
  });

  it("doesn't let neighboring text bleed into the extracted location", () => {
    // A regression check for a real bug: joining the whole card's text into one string before
    // matching let the location regex swallow everything back to the previous capital letter
    // ("Container Service Locations Seattle, WA, USA" instead of just "Seattle, WA, USA").
    const html = [
      `<div class="card"><h3><a href="/jobs/container-service-engineer">Container Service Engineer</a></h3>` +
        `<span>Locations</span><ul><li>Seattle, WA, USA</li></ul></div>`,
      `<a href="/jobs/data-scientist-def">Data Scientist</a>`,
      `<a href="/jobs/product-manager-ghi">Product Manager</a>`,
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    const engineer = result?.postings.find((p) => p.title === "Container Service Engineer");
    expect(engineer?.location).toBe("Seattle, WA, USA");
  });

  it("leaves location null when no card text matches the location shape", () => {
    const html = [
      `<a href="/jobs/software-engineer-abc">Software Engineer</a>`,
      `<a href="/jobs/data-scientist-def">Data Scientist</a>`,
      `<a href="/jobs/product-manager-ghi">Product Manager</a>`,
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.postings.every((p) => p.location === null)).toBe(true);
  });

  it("de-duplicates the same href appearing more than once on the page", () => {
    const html = [
      `<a href="/jobs/software-engineer-abc">Software Engineer</a>`,
      `<a href="/jobs/software-engineer-abc">Software Engineer (mobile nav)</a>`,
      `<a href="/jobs/data-scientist-def">Data Scientist</a>`,
      `<a href="/jobs/product-manager-ghi">Product Manager</a>`,
    ].join("\n");
    const result = extractGenericBoardPostings(html, BASE_URL);
    expect(result?.postings).toHaveLength(3);
  });
});

describe("extractGenericBoardPostings — no signal", () => {
  it("returns null for a page with neither JSON-LD nor enough job-shaped links (JS-rendered page)", () => {
    const html = `<html><body><div id="root"></div></body></html>`;
    expect(extractGenericBoardPostings(html, BASE_URL)).toBeNull();
  });
});

describe("findNextPageUrl", () => {
  it("follows an a[rel=next] link", () => {
    const html = `<a rel="next" href="/jobs/search?page=2">Next</a>`;
    expect(findNextPageUrl(html, BASE_URL)).toBe("https://careers.example.com/jobs/search?page=2");
  });

  it("follows a link[rel=next] in the head", () => {
    const html = `<head><link rel="next" href="/jobs/search?page=2" /></head>`;
    expect(findNextPageUrl(html, BASE_URL)).toBe("https://careers.example.com/jobs/search?page=2");
  });

  it("returns null when there's no next-page signal — the common 'last page' case", () => {
    expect(findNextPageUrl("<html></html>", BASE_URL)).toBeNull();
  });

  it("returns null for an off-host next link rather than following it (safety)", () => {
    const html = `<a rel="next" href="https://evil.example.com/jobs?page=2">Next</a>`;
    expect(findNextPageUrl(html, BASE_URL)).toBeNull();
  });

  it("returns null when next points back at the current page — loop guard", () => {
    const html = `<a rel="next" href="${BASE_URL}">Next</a>`;
    expect(findNextPageUrl(html, BASE_URL)).toBeNull();
  });

  it("follows numbered pagination — current page marked with aria-current", () => {
    const html = [
      `<nav class="pagination">`,
      `<a href="/jobs/search?page=1">1</a>`,
      `<a href="/jobs/search?page=2" aria-current="page">2</a>`,
      `<a href="/jobs/search?page=3">3</a>`,
      `</nav>`,
    ].join("\n");
    expect(findNextPageUrl(html, "https://careers.example.com/jobs/search?page=2")).toBe(
      "https://careers.example.com/jobs/search?page=3",
    );
  });

  it("follows numbered pagination — current page rendered as a non-link (the common shape)", () => {
    const html = [
      `<ul class="pager">`,
      `<li><a href="/jobs/search?page=1">1</a></li>`,
      `<li class="active">2</li>`,
      `<li><a href="/jobs/search?page=3">3</a></li>`,
      `</ul>`,
    ].join("\n");
    expect(findNextPageUrl(html, "https://careers.example.com/jobs/search?page=2")).toBe(
      "https://careers.example.com/jobs/search?page=3",
    );
  });

  it("picks the lowest page number as 'current' when nothing marks one explicitly", () => {
    // A bare list of page links with no current-page indicator at all — treat the lowest as
    // where we are (we're following forward from the first URL we fetch) and go to the next.
    const html = [
      `<a href="/jobs/search?page=1">1</a>`,
      `<a href="/jobs/search?page=2">2</a>`,
      `<a href="/jobs/search?page=3">3</a>`,
    ].join("\n");
    expect(findNextPageUrl(html, "https://careers.example.com/jobs/search?page=1")).toBe(
      "https://careers.example.com/jobs/search?page=2",
    );
  });

  it("ignores a single stray digit that isn't part of a real pagination cluster", () => {
    const html = `<span class="job-count">42</span> open roles`;
    expect(findNextPageUrl(html, BASE_URL)).toBeNull();
  });

  it("returns null for numbered pagination with no real href on the next page (JS-only pager)", () => {
    const html = [
      `<button class="active">1</button>`,
      `<button data-page="2">2</button>`,
      `<button data-page="3">3</button>`,
    ].join("\n");
    expect(findNextPageUrl(html, BASE_URL)).toBeNull();
  });

  it("follows a 'Next' text link with no rel=\"next\" attribute", () => {
    const html = `<a href="/jobs/search?page=2">Next ›</a>`;
    expect(findNextPageUrl(html, BASE_URL)).toBe("https://careers.example.com/jobs/search?page=2");
  });

  it("prefers rel=\"next\" over a numbered-pagination match when both are present", () => {
    const html = [
      `<a rel="next" href="/jobs/search?page=5">Skip ahead</a>`,
      `<a href="/jobs/search?page=1">1</a>`,
      `<a href="/jobs/search?page=2" aria-current="page">2</a>`,
      `<a href="/jobs/search?page=3">3</a>`,
    ].join("\n");
    expect(findNextPageUrl(html, "https://careers.example.com/jobs/search?page=2")).toBe(
      "https://careers.example.com/jobs/search?page=5",
    );
  });
});
