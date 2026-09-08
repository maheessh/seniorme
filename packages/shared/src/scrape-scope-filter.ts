const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ScrapeScopeFilters = {
  rolesOfInterest: string[];
  targetLocationKeywords: string[];
  maxPostingAgeDays: number | null;
};

export type ScrapeScopeCandidate = {
  title: string;
  location: string | null;
  postedAt: Date | null;
};

/**
 * A user's own scrape-scope preferences for a company they track — narrows what they see in
 * their Inbox, not what gets scraped/stored (the underlying Job catalog is shared across every
 * user tracking that company, so it has to stay complete).
 */
export function matchesScrapeScope(candidate: ScrapeScopeCandidate, filters: ScrapeScopeFilters): boolean {
  if (filters.rolesOfInterest.length > 0) {
    const title = candidate.title.toLowerCase();
    if (!filters.rolesOfInterest.some((keyword) => title.includes(keyword.toLowerCase()))) {
      return false;
    }
  }

  if (filters.targetLocationKeywords.length > 0) {
    // A posting with no location data at all can't be confirmed to match a location filter, so
    // it's excluded rather than let through by default — the whole point of this filter is
    // narrowing a large board down, and letting every location-less posting through would
    // defeat that for exactly the sites most likely to need it.
    if (!candidate.location) return false;
    const location = candidate.location.toLowerCase();
    if (!filters.targetLocationKeywords.some((keyword) => location.includes(keyword.toLowerCase()))) {
      return false;
    }
  }

  if (filters.maxPostingAgeDays != null && candidate.postedAt) {
    const ageDays = (Date.now() - candidate.postedAt.getTime()) / MS_PER_DAY;
    if (ageDays > filters.maxPostingAgeDays) return false;
  }

  return true;
}
