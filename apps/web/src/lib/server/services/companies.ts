import { prisma, Prisma, type Priority } from "@ccc/db";
import type { CompanyInput } from "@ccc/shared";

export class DuplicateDomainError extends Error {
  constructor(domain: string) {
    super(`You're already tracking a company with domain "${domain}".`);
    this.name = "DuplicateDomainError";
  }
}

export function deriveLogoUrl(domain: string | undefined): string | null {
  // DuckDuckGo's icon service resolves a real favicon/logo for a bare domain with no API
  // key and no rate limiting for personal use — more reliable than Clearbit's now-defunct
  // free logo API.
  return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
}

export type CompanyFilters = {
  search?: string;
  priority?: Priority;
};

// Flattened shared-Company + this-user's-UserCompany fields into one shape, matching how the
// UI already treats "a tracked company" as a single blended record — the split only matters at
// the database layer.
export type CompanyWithSources = {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  website: string | null;
  location: string | null;
  industry: string | null;
  priority: Priority;
  notes: string | null;
  rolesOfInterest: string[];
  targetLocationKeywords: string[];
  maxPostingAgeDays: number | null;
  monitoringEnabled: boolean;
  careerSources: Prisma.CareerSourceGetPayload<object>[];
};

function flatten(
  userCompany: Prisma.UserCompanyGetPayload<{
    include: { company: { include: { careerSources: true } } };
  }>,
): CompanyWithSources {
  const { company, ...prefs } = userCompany;
  return {
    id: company.id,
    name: company.name,
    domain: company.domain,
    logoUrl: company.logoUrl,
    website: company.website,
    location: company.location,
    industry: company.industry,
    priority: prefs.priority,
    notes: prefs.notes,
    rolesOfInterest: prefs.rolesOfInterest,
    targetLocationKeywords: prefs.targetLocationKeywords,
    maxPostingAgeDays: prefs.maxPostingAgeDays,
    monitoringEnabled: prefs.monitoringEnabled,
    careerSources: company.careerSources,
  };
}

export async function listCompanies(userId: string, filters: CompanyFilters = {}): Promise<CompanyWithSources[]> {
  const rows = await prisma.userCompany.findMany({
    where: {
      userId,
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.search
        ? {
            company: {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { domain: { contains: filters.search, mode: "insensitive" } },
                { industry: { contains: filters.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ priority: "desc" }, { company: { name: "asc" } }],
    include: { company: { include: { careerSources: { orderBy: { createdAt: "asc" } } } } },
  });
  return rows.map(flatten);
}

export async function getCompany(userId: string, companyId: string): Promise<CompanyWithSources | null> {
  const row = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    include: { company: { include: { careerSources: { orderBy: { createdAt: "asc" } } } } },
  });
  return row ? flatten(row) : null;
}

/** Lightweight search for the Inbox filter's company picker — scoped to companies this user
 * tracks, since those are the only ones a filter chip could ever match. */
export function searchCompanies(userId: string, query: string, limit = 8) {
  return prisma.company.findMany({
    where: {
      userCompanies: { some: { userId } },
      ...(query.trim() ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

/** Lightweight search across the whole shared catalog, for the job-import company picker —
 * deliberately unscoped, so importing a job can reuse a company another user already tracks
 * instead of silently creating a duplicate. */
export function searchAllCompanies(query: string, limit = 8) {
  if (!query.trim()) return prisma.company.findMany({ orderBy: { name: "asc" }, take: limit });
  return prisma.company.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: limit,
  });
}

/** Resolves a filter's selected-company chips (e.g. from a `?companies=id1,id2` URL param) back
 * into full records — silently drops any id that no longer exists (or isn't tracked by this
 * user) rather than erroring, since a stale/shared URL outliving that is a normal case. */
export function getCompaniesByIds(userId: string, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.company.findMany({
    where: { id: { in: ids }, userCompanies: { some: { userId } } },
    orderBy: { name: "asc" },
  });
}

function userCompanyPrefs(input: CompanyInput) {
  return {
    priority: input.priority,
    notes: input.notes ?? null,
    rolesOfInterest: input.rolesOfInterest,
    targetLocationKeywords: input.targetLocationKeywords,
    maxPostingAgeDays: input.maxPostingAgeDays,
    monitoringEnabled: input.monitoringEnabled,
  };
}

/**
 * Tracks a company for this user. If a company with this domain already exists in the shared
 * catalog (another user tracks it, or it was discovered as a byproduct of a job import), reuses
 * it rather than erroring — "already tracked globally" isn't a conflict, it's the normal case
 * two users' interests overlapping. DuplicateDomainError now means only "you're already
 * tracking this domain yourself."
 */
export async function createCompany(userId: string, input: CompanyInput): Promise<CompanyWithSources> {
  const domain = input.domain || undefined;

  let companyId: string;
  const existing = domain ? await prisma.company.findUnique({ where: { domain } }) : null;
  if (existing) {
    companyId = existing.id;
  } else {
    const company = await prisma.company.create({
      data: {
        name: input.name,
        domain: domain ?? null,
        logoUrl: deriveLogoUrl(domain),
        website: input.website ?? null,
        location: input.location ?? null,
        industry: input.industry ?? null,
      },
    });
    companyId = company.id;
  }

  try {
    await prisma.userCompany.create({ data: { userId, companyId, ...userCompanyPrefs(input) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && domain) {
      throw new DuplicateDomainError(domain);
    }
    throw error;
  }

  return getCompany(userId, companyId) as Promise<CompanyWithSources>;
}

/** Updates both the shared Company directory fields and this user's own tracking preferences. */
export async function updateCompany(
  userId: string,
  companyId: string,
  input: CompanyInput,
): Promise<CompanyWithSources> {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      name: input.name,
      domain: input.domain ?? null,
      logoUrl: deriveLogoUrl(input.domain),
      website: input.website ?? null,
      location: input.location ?? null,
      industry: input.industry ?? null,
    },
  });

  await prisma.userCompany.update({
    where: { userId_companyId: { userId, companyId } },
    data: userCompanyPrefs(input),
  });

  return getCompany(userId, companyId) as Promise<CompanyWithSources>;
}

/** "Untracks" a company for this user — deletes only their UserCompany row. The shared Company,
 * its scraped Jobs, and CareerSources are never touched, since other users may still track it. */
export function untrackCompany(userId: string, companyId: string) {
  return prisma.userCompany.delete({ where: { userId_companyId: { userId, companyId } } });
}
