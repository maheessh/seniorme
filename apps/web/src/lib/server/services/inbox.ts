import { prisma, type InboxStatus, type Prisma } from "@ccc/db";

export const INBOX_STATUSES: InboxStatus[] = [
  "NEW",
  "INTERESTED",
  "SAVED",
  "APPLIED",
  "NOT_INTERESTED",
  "IGNORED",
];

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

export function listInboxJobs(status: InboxStatus) {
  return prisma.job.findMany({
    where: { inboxStatus: status },
    orderBy: { discoveredAt: "desc" },
    include: inboxJobInclude,
  });
}

const STATUS_SUMMARY: Record<InboxStatus, string> = {
  NEW: "Reset to new",
  INTERESTED: "Marked interested",
  SAVED: "Saved for later",
  APPLIED: "Applied to",
  NOT_INTERESTED: "Marked not interested",
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
