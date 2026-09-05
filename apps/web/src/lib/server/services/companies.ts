import { prisma, Prisma, type Priority } from "@ccc/db";
import type { CompanyInput } from "@ccc/shared";

export class DuplicateDomainError extends Error {
  constructor(domain: string) {
    super(`A company with domain "${domain}" is already tracked.`);
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

export type CompanyWithSources = Prisma.CompanyGetPayload<{
  include: { careerSources: true };
}>;

export function listCompanies(filters: CompanyFilters = {}) {
  return prisma.company.findMany({
    where: {
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { domain: { contains: filters.search, mode: "insensitive" } },
              { industry: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    include: { careerSources: { orderBy: { createdAt: "asc" } } },
  });
}

export function getCompany(id: string) {
  return prisma.company.findUnique({ where: { id } });
}

/** Lightweight search for autocomplete pickers (job import's company field, the Inbox filter). */
export function searchCompanies(query: string, limit = 8) {
  if (!query.trim()) return prisma.company.findMany({ orderBy: { name: "asc" }, take: limit });
  return prisma.company.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: limit,
  });
}

/** Resolves a filter's selected-company chips (e.g. from a `?companies=id1,id2` URL param) back
 * into full records — silently drops any id that no longer exists rather than erroring, since a
 * stale/shared URL outliving a deleted company is a normal case, not a bug. */
export function getCompaniesByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.company.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } });
}

async function handleUniqueConstraint<T>(fn: () => Promise<T>, domain: string | undefined) {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      domain
    ) {
      throw new DuplicateDomainError(domain);
    }
    throw error;
  }
}

export function createCompany(input: CompanyInput) {
  return handleUniqueConstraint(
    () =>
      prisma.company.create({
        data: {
          name: input.name,
          domain: input.domain ?? null,
          logoUrl: deriveLogoUrl(input.domain),
          website: input.website ?? null,
          location: input.location ?? null,
          industry: input.industry ?? null,
          priority: input.priority,
          notes: input.notes ?? null,
          rolesOfInterest: input.rolesOfInterest,
          targetLocationKeywords: input.targetLocationKeywords,
          maxPostingAgeDays: input.maxPostingAgeDays,
          monitoringEnabled: input.monitoringEnabled,
        },
      }),
    input.domain,
  );
}

export function updateCompany(id: string, input: CompanyInput) {
  return handleUniqueConstraint(
    () =>
      prisma.company.update({
        where: { id },
        data: {
          name: input.name,
          domain: input.domain ?? null,
          logoUrl: deriveLogoUrl(input.domain),
          website: input.website ?? null,
          location: input.location ?? null,
          industry: input.industry ?? null,
          priority: input.priority,
          notes: input.notes ?? null,
          rolesOfInterest: input.rolesOfInterest,
          targetLocationKeywords: input.targetLocationKeywords,
          maxPostingAgeDays: input.maxPostingAgeDays,
          monitoringEnabled: input.monitoringEnabled,
        },
      }),
    input.domain,
  );
}

export function deleteCompany(id: string) {
  return prisma.company.delete({ where: { id } });
}
