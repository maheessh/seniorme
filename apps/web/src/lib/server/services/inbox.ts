import { prisma, type EmploymentType, type InboxStatus, type Prisma } from "@ccc/db";
import { matchesScrapeScope, type ScrapeScopeFilters } from "@ccc/shared";

export const INBOX_STATUSES: InboxStatus[] = ["NEW", "SAVED", "APPLIED", "IGNORED"];

export type InboxCounts = Record<InboxStatus, number>;

const visibleJobInclude = {
  company: true,
  possibleDuplicateOf: { select: { id: true, title: true } },
} satisfies Prisma.JobInclude;

export type InboxJob = Prisma.JobGetPayload<{ include: typeof visibleJobInclude }>;

type VisibleJob = InboxJob & { inboxStatus: InboxStatus };

/**
 * Every job belonging to a company this user tracks, not removed. Each job is tagged with this
 * user's own triage status — NEW when there's no UserJobStatus row yet, since "never triaged"
 * and "explicitly marked NEW" mean the same thing.
 *
 * A company's scrape-scope filters (role/location/age — set per UserCompany, applied here
 * rather than at scrape time since the underlying Job catalog is shared across every user
 * tracking the company) narrow the *undecided* NEW postings only. A job the user already
 * SAVED/APPLIED/IGNORED stays visible even if it wouldn't match a filter they set (or later
 * tightened) — the filter's job is cutting discovery noise, not un-remembering a decision
 * already made.
 */
async function getVisibleJobsForUser(userId: string): Promise<VisibleJob[]> {
  const trackedCompanies = await prisma.userCompany.findMany({
    where: { userId },
    select: {
      companyId: true,
      rolesOfInterest: true,
      targetLocationKeywords: true,
      maxPostingAgeDays: true,
    },
  });
  if (trackedCompanies.length === 0) return [];

  const filtersByCompany = new Map<string, ScrapeScopeFilters>(
    trackedCompanies.map((c) => [
      c.companyId,
      {
        rolesOfInterest: c.rolesOfInterest,
        targetLocationKeywords: c.targetLocationKeywords,
        maxPostingAgeDays: c.maxPostingAgeDays,
      },
    ]),
  );

  const jobs = await prisma.job.findMany({
    where: { companyId: { in: [...filtersByCompany.keys()] }, isRemoved: false },
    include: { ...visibleJobInclude, userStatuses: { where: { userId } } },
    orderBy: { discoveredAt: "desc" },
  });

  return jobs
    .map(({ userStatuses, ...job }) => ({ ...job, inboxStatus: userStatuses[0]?.status ?? ("NEW" as InboxStatus) }))
    .filter(
      (job) => job.inboxStatus !== "NEW" || matchesScrapeScope(job, filtersByCompany.get(job.companyId)!),
    );
}

export async function countInboxJobs(userId: string): Promise<InboxCounts> {
  const jobs = await getVisibleJobsForUser(userId);
  const counts = Object.fromEntries(INBOX_STATUSES.map((status) => [status, 0])) as InboxCounts;
  for (const job of jobs) counts[job.inboxStatus] += 1;
  return counts;
}

export type InboxFilters = {
  companyIds?: string[];
  employmentTypes?: EmploymentType[];
};

export async function listInboxJobs(
  userId: string,
  status: InboxStatus,
  filters: InboxFilters = {},
): Promise<InboxJob[]> {
  const jobs = await getVisibleJobsForUser(userId);
  return jobs.filter(
    (job) =>
      job.inboxStatus === status &&
      (!filters.companyIds?.length || filters.companyIds.includes(job.companyId)) &&
      (!filters.employmentTypes?.length ||
        (job.employmentType && filters.employmentTypes.includes(job.employmentType))),
  );
}

const STATUS_SUMMARY: Record<InboxStatus, string> = {
  NEW: "Reset to new",
  SAVED: "Saved for later",
  APPLIED: "Applied to",
  IGNORED: "Ignored",
};

async function logStatusChange(userId: string, jobId: string, jobTitle: string, companyName: string, status: InboxStatus) {
  await prisma.activityEvent.create({
    data: {
      userId,
      type: "job_status_changed",
      entityType: "job",
      entityId: jobId,
      jobId,
      summary: `${STATUS_SUMMARY[status]}: ${jobTitle} at ${companyName}`,
    },
  });
}

export async function setInboxStatus(userId: string, jobId: string, status: InboxStatus): Promise<void> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { company: true },
  });

  await prisma.userJobStatus.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: { userId, jobId, status },
    update: { status },
  });
  await logStatusChange(userId, jobId, job.title, job.company.name, status);

  if (status === "APPLIED") {
    const existing = await prisma.application.findUnique({ where: { userId_jobId: { userId, jobId } } });
    if (!existing) {
      const application = await prisma.application.create({
        data: {
          jobId,
          companyId: job.companyId,
          userId,
          stage: "APPLIED",
          appliedAt: new Date(),
          descriptionSnapshot: job.descriptionRaw,
        },
      });
      await prisma.applicationEvent.create({
        data: { applicationId: application.id, fromStage: null, toStage: "APPLIED" },
      });
      await prisma.activityEvent.create({
        data: {
          userId,
          type: "application_created",
          entityType: "application",
          entityId: jobId,
          jobId,
          summary: `Added to pipeline: ${job.title} at ${job.company.name}`,
        },
      });
    }
  }
}

/** Clears the fuzzy-duplicate flag — a fact about the shared Job itself (not per-user), so
 * clearing it benefits everyone who sees this posting, not just the user who noticed it. */
export async function clearPossibleDuplicate(jobId: string): Promise<void> {
  await prisma.job.update({ where: { id: jobId }, data: { possibleDuplicateOfId: null } });
}

/**
 * Applies a status change to several jobs at once (bulk select in the Inbox — e.g. "ignore
 * everything I just filtered down to for this company"). Reuses `setInboxStatus` per job rather
 * than a single `updateMany`, since each one also logs its own ActivityEvent and (for APPLIED)
 * creates its own Application/ApplicationEvent — a bulk-optimized single query would either lose
 * that per-job bookkeeping or need to reimplement it, and a batch here is realistically dozens to
 * a few hundred jobs, not a scale where the query-per-job cost actually matters.
 */
export async function bulkSetInboxStatus(userId: string, jobIds: string[], status: InboxStatus): Promise<void> {
  for (const jobId of jobIds) {
    await setInboxStatus(userId, jobId, status);
  }
}
