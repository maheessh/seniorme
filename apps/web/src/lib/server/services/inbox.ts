import { prisma, type EmploymentType, type InboxStatus, type Prisma } from "@ccc/db";

export const INBOX_STATUSES: InboxStatus[] = ["NEW", "SAVED", "APPLIED", "IGNORED"];

export type InboxCounts = Record<InboxStatus, number>;

export async function countInboxJobs(): Promise<InboxCounts> {
  const rows = await prisma.job.groupBy({ by: ["inboxStatus"], _count: { _all: true } });
  const counts = Object.fromEntries(INBOX_STATUSES.map((status) => [status, 0])) as InboxCounts;
  for (const row of rows) counts[row.inboxStatus] = row._count._all;
  return counts;
}

const inboxJobInclude = {
  company: true,
  possibleDuplicateOf: { select: { id: true, title: true } },
} satisfies Prisma.JobInclude;

export type InboxJob = Prisma.JobGetPayload<{ include: typeof inboxJobInclude }>;

export type InboxFilters = {
  companyIds?: string[];
  employmentTypes?: EmploymentType[];
};

export function listInboxJobs(status: InboxStatus, filters: InboxFilters = {}) {
  return prisma.job.findMany({
    where: {
      inboxStatus: status,
      ...(filters.companyIds?.length ? { companyId: { in: filters.companyIds } } : {}),
      ...(filters.employmentTypes?.length ? { employmentType: { in: filters.employmentTypes } } : {}),
    },
    orderBy: { discoveredAt: "desc" },
    include: inboxJobInclude,
  });
}

const STATUS_SUMMARY: Record<InboxStatus, string> = {
  NEW: "Reset to new",
  SAVED: "Saved for later",
  APPLIED: "Applied to",
  IGNORED: "Ignored",
};

async function logStatusChange(jobId: string, jobTitle: string, companyName: string, status: InboxStatus) {
  await prisma.activityEvent.create({
    data: {
      type: "job_status_changed",
      entityType: "job",
      entityId: jobId,
      jobId,
      summary: `${STATUS_SUMMARY[status]}: ${jobTitle} at ${companyName}`,
    },
  });
}

export async function setInboxStatus(jobId: string, status: InboxStatus): Promise<void> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { company: true },
  });

  await prisma.job.update({ where: { id: jobId }, data: { inboxStatus: status } });
  await logStatusChange(jobId, job.title, job.company.name, status);

  if (status === "APPLIED") {
    const existing = await prisma.application.findUnique({ where: { jobId } });
    if (!existing) {
      const application = await prisma.application.create({
        data: {
          jobId,
          companyId: job.companyId,
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
export async function bulkSetInboxStatus(jobIds: string[], status: InboxStatus): Promise<void> {
  for (const jobId of jobIds) {
    await setInboxStatus(jobId, status);
  }
}
