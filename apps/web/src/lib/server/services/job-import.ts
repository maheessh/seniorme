import { Prisma, prisma, type EmploymentType, type WorkMode } from "@ccc/db";
import { extractJobFromUrl, hashUrl } from "@ccc/scraper";
import { deriveLogoUrl } from "./companies";
import { setInboxStatus } from "./inbox";

export { extractJobFromUrl };

async function resolveCompany(input: {
  companyId?: string;
  newCompanyName?: string;
  newCompanyDomain?: string;
}): Promise<string> {
  if (input.companyId) return input.companyId;

  const name = input.newCompanyName?.trim();
  if (!name) throw new Error("Company name is required");
  const domain = input.newCompanyDomain?.trim().toLowerCase() || undefined;

  try {
    const company = await prisma.company.create({
      data: { name, domain: domain ?? null, logoUrl: deriveLogoUrl(domain) },
    });
    return company.id;
  } catch (error) {
    // Someone's already tracking this domain — reuse that company instead of erroring, since
    // "the company already exists" is more helpful here than a hard failure mid-import.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && domain) {
      const existing = await prisma.company.findUnique({ where: { domain } });
      if (existing) return existing.id;
    }
    throw error;
  }
}

export type JobImportInput = {
  url: string;
  title: string;
  companyId?: string;
  newCompanyName?: string;
  newCompanyDomain?: string;
  location?: string;
  workMode: WorkMode;
  employmentType: EmploymentType | null;
  description?: string;
  postedAt?: Date | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  externalJobId?: string | null;
  addToPipeline: boolean;
};

export async function importJob(input: JobImportInput): Promise<{ jobId: string; alreadyExisted: boolean }> {
  const companyId = await resolveCompany(input);
  const canonicalUrlHash = hashUrl(input.url);

  const existing = await prisma.job.findFirst({
    where: {
      OR: [
        { canonicalUrlHash },
        ...(input.externalJobId ? [{ companyId, externalJobId: input.externalJobId }] : []),
      ],
    },
  });

  let jobId: string;
  if (existing) {
    jobId = existing.id;
  } else {
    const created = await prisma.job.create({
      data: {
        companyId,
        title: input.title,
        location: input.location || null,
        workMode: input.workMode,
        employmentType: input.employmentType,
        url: input.url,
        canonicalUrlHash,
        externalJobId: input.externalJobId || null,
        descriptionRaw: input.description || null,
        postedAt: input.postedAt ?? null,
        salaryMin: input.salaryMin ?? null,
        salaryMax: input.salaryMax ?? null,
      },
    });
    jobId = created.id;

    await prisma.activityEvent.create({
      data: {
        type: "job_imported",
        entityType: "job",
        entityId: created.id,
        jobId: created.id,
        summary: `Imported job: ${created.title}`,
      },
    });
  }

  // Reuses the same status-change logic the Inbox uses (activity logging, Application
  // creation on APPLIED) so an imported job behaves identically to a discovered one from here on.
  await setInboxStatus(jobId, input.addToPipeline ? "APPLIED" : "INTERESTED");

  return { jobId, alreadyExisted: Boolean(existing) };
}
