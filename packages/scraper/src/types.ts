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
  /**
   * False when a paginated fetch stopped early (a later page failed, was blocked, or the page
   * cap was hit) instead of reaching a natural end. Callers must not treat `postings` as the
   * full current listing when this is false — in particular, it must not be used to infer that
   * an existing job absent from `postings` has been removed from the source. Omitted/undefined
   * means true (single-request adapters can't return a partial result).
   */
  complete?: boolean;
};

export interface CareerSiteAdapter {
  readonly type: SourceType;
  /** Does this adapter know how to handle this career page URL? */
  matches(url: URL): boolean;
  /** Fetch and parse all current postings from the source. Throws on failure. */
  fetchPostings(sourceUrl: string): Promise<AdapterFetchResult>;
}
