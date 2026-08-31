import { prisma, type ApplicationStage, type Prisma } from "@ccc/db";
import { ALL_STAGES, STAGE_LABEL } from "@ccc/shared";

const PRE_APPLY_STAGES = new Set<ApplicationStage>(["SAVED", "PREPARING"]);

const applicationInclude = {
  job: true,
  company: true,
  contact: true,
} satisfies Prisma.ApplicationInclude;

export type ApplicationWithRelations = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

export type ApplicationFilters = { stage?: ApplicationStage; search?: string };

export function listApplications(filters: ApplicationFilters = {}) {
  return prisma.application.findMany({
    where: {
      ...(filters.stage ? { stage: filters.stage } : {}),
      ...(filters.search
        ? {
            OR: [
              { job: { title: { contains: filters.search, mode: "insensitive" } } },
              { company: { name: { contains: filters.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: applicationInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getApplicationsByStage(): Promise<Record<ApplicationStage, ApplicationWithRelations[]>> {
  const all = await prisma.application.findMany({ include: applicationInclude, orderBy: { updatedAt: "desc" } });
  const grouped = {} as Record<ApplicationStage, ApplicationWithRelations[]>;
  for (const stage of ALL_STAGES) grouped[stage] = [];
  for (const application of all) grouped[application.stage].push(application);
  return grouped;
}

const applicationDetailInclude = {
  job: true,
  company: true,
  contact: true,
  events: { orderBy: { occurredAt: "desc" as const } },
} satisfies Prisma.ApplicationInclude;

export type ApplicationDetail = Prisma.ApplicationGetPayload<{ include: typeof applicationDetailInclude }>;

export function getApplication(id: string) {
  return prisma.application.findUnique({ where: { id }, include: applicationDetailInclude });
}

async function logGlobalActivity(applicationId: string, jobId: string, summary: string) {
  await prisma.activityEvent.create({
    data: {
      type: "application_stage_changed",
      entityType: "application",
      entityId: applicationId,
      jobId,
      summary,
    },
  });
}

export async function moveApplicationStage(
  id: string,
  toStage: ApplicationStage,
  options: { note?: string; scheduledAt?: Date } = {},
): Promise<void> {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id },
    include: { job: true, company: true },
  });

  await prisma.$transaction([
    prisma.application.update({
      where: { id },
      data: {
        stage: toStage,
        appliedAt:
          application.appliedAt ?? (!PRE_APPLY_STAGES.has(toStage) ? new Date() : application.appliedAt),
      },
    }),
    prisma.applicationEvent.create({
      data: {
        applicationId: id,
        fromStage: application.stage,
        toStage,
        note: options.note,
        scheduledAt: options.scheduledAt,
      },
    }),
  ]);

  await logGlobalActivity(
    id,
    application.jobId,
    `${application.job.title} at ${application.company.name} moved to ${STAGE_LABEL[toStage]}`,
  );
}

export async function addApplicationNote(id: string, note: string, scheduledAt?: Date): Promise<void> {
  const application = await prisma.application.findUniqueOrThrow({ where: { id } });
  await prisma.applicationEvent.create({
    data: { applicationId: id, fromStage: application.stage, toStage: application.stage, note, scheduledAt },
  });
}

export type ApplicationDetailsInput = {
  deadline?: Date | null;
  followUpDate?: Date | null;
  resumeVersion?: string | null;
  coverLetter?: string | null;
  notes?: string | null;
  recruiterContactId?: string | null;
};

export function updateApplicationDetails(id: string, data: ApplicationDetailsInput) {
  return prisma.application.update({ where: { id }, data });
}

export function listContactsForCompany(companyId: string) {
  return prisma.contact.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export type ContactInput = {
  name: string;
  role?: string | null;
  email?: string | null;
  linkedInUrl?: string | null;
};

export function createContact(companyId: string, input: ContactInput) {
  return prisma.contact.create({ data: { companyId, ...input } });
}
