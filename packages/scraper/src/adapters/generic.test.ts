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
});
