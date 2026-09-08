import { prisma, type Prisma, type SupportRequestStatus } from "@ccc/db";

export class SupportRequestError extends Error {}

const requestWithRelations = {
  user: { select: { email: true, name: true } },
  company: { select: { name: true, domain: true, website: true } },
} satisfies Prisma.ScraperSupportRequestInclude;

export type SupportRequestForAdmin = Prisma.ScraperSupportRequestGetPayload<{
  include: typeof requestWithRelations;
}>;

/** The career-source ids this user already has an open (OPEN/IN_PROGRESS) request for — used
 * to show a "requested" state on the row instead of letting them file duplicates. */
export async function getOpenRequestSourceIds(userId: string): Promise<string[]> {
  const rows = await prisma.scraperSupportRequest.findMany({
    where: { userId, status: { in: ["OPEN", "IN_PROGRESS"] }, careerSourceId: { not: null } },
    select: { careerSourceId: true },
  });
  return rows.map((r) => r.careerSourceId!).filter(Boolean);
}

/**
 * Files a request for the team to build/fix scraping for a company whose board errored. Snapshots
 * the company + source details so the admin queue is self-contained. Refuses a duplicate while an
 * earlier request for the same source is still open.
 */
export async function createSupportRequest(
  userId: string,
  input: { companyId: string; careerSourceId?: string; note?: string },
): Promise<void> {
  const company = await prisma.company.findFirst({
    where: { id: input.companyId, userCompanies: { some: { userId } } },
    select: { id: true, name: true, domain: true, website: true },
  });
  if (!company) throw new SupportRequestError("Company not found.");

  let sourceUrl = company.website ?? "";
  let errorMessage: string | null = null;
  if (input.careerSourceId) {
    const source = await prisma.careerSource.findFirst({
      where: { id: input.careerSourceId, companyId: company.id },
      select: { url: true, lastError: true },
    });
    if (!source) throw new SupportRequestError("Career page not found.");
    sourceUrl = source.url;
    errorMessage = source.lastError;

    const existing = await prisma.scraperSupportRequest.findFirst({
      where: {
        userId,
        careerSourceId: input.careerSourceId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (existing) throw new SupportRequestError("You've already requested support for this page.");
  }

  await prisma.scraperSupportRequest.create({
    data: {
      userId,
      companyId: company.id,
      careerSourceId: input.careerSourceId ?? null,
      companyName: company.name,
      domain: company.domain,
      website: company.website,
      sourceUrl,
      errorMessage,
      note: input.note?.trim() || null,
    },
  });
}

export type SupportRequestFilters = { status?: SupportRequestStatus };

export function listSupportRequests(filters: SupportRequestFilters = {}) {
  return prisma.scraperSupportRequest.findMany({
    where: { ...(filters.status ? { status: filters.status } : {}) },
    include: requestWithRelations,
    // Open first, then oldest-first within a status so the queue is FIFO.
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function countSupportRequestsByStatus(): Promise<Record<SupportRequestStatus, number>> {
  const grouped = await prisma.scraperSupportRequest.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 } as Record<SupportRequestStatus, number>;
  for (const row of grouped) counts[row.status] = row._count._all;
  return counts;
}

const STATUS_MESSAGE: Record<SupportRequestStatus, { title: (name: string) => string; body: string }> = {
  OPEN: { title: (n) => `Support request reopened for ${n}`, body: "We're taking another look." },
  IN_PROGRESS: {
    title: (n) => `We're building scraping support for ${n}`,
    body: "Your request is now in progress — we'll let you know when it's ready.",
  },
  RESOLVED: {
    title: (n) => `Scraping is ready for ${n}`,
    body: "We've added support for this company's board — its jobs will start showing up in your inbox on the next check.",
  },
};

/**
 * Admin action: moves a request to a new status. On RESOLVED, stamps resolvedAt and notifies the
 * requesting user; IN_PROGRESS also notifies (a useful "we're on it" signal). The notification is
 * deduped per status transition so re-saving the same status doesn't re-notify.
 */
export async function setSupportRequestStatus(
  requestId: string,
  status: SupportRequestStatus,
): Promise<void> {
  const request = await prisma.scraperSupportRequest.update({
    where: { id: requestId },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
    select: { userId: true, companyName: true, companyId: true },
  });

  if (status === "RESOLVED" || status === "IN_PROGRESS") {
    const msg = STATUS_MESSAGE[status];
    await prisma.notification.upsert({
      where: {
        userId_dedupeKey: { userId: request.userId, dedupeKey: `support-${status}:${requestId}` },
      },
      create: {
        userId: request.userId,
        type: "SCRAPER_REQUEST_RESOLVED",
        title: msg.title(request.companyName),
        body: msg.body,
        linkUrl: "/companies",
        entityType: "company",
        entityId: request.companyId,
        dedupeKey: `support-${status}:${requestId}`,
      },
      update: {},
    });
  }
}
