import type { EmploymentType, SourceType, WorkMode } from "@ccc/db";

export type RawJobPosting = {
  externalJobId: string;
  title: string;
  url: string;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType | null;
  description: string | null;
  postedAt: Date | null;
};

export type AdapterFetchResult = {
  postings: RawJobPosting[];
};

export interface CareerSiteAdapter {
  readonly type: SourceType;
  /** Does this adapter know how to handle this career page URL? */
  matches(url: URL): boolean;
  /** Fetch and parse all current postings from the source. Throws on failure. */
  fetchPostings(sourceUrl: string): Promise<AdapterFetchResult>;
}
