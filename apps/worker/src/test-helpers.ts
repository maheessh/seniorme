import { prisma, type Prisma } from "@ccc/db";

const TABLES = [
  "Notification",
  "ActivityEvent",
  "GoalMilestone",
  "Goal",
  "ProjectTask",
  "Project",
  "Contact",
  "ApplicationEvent",
  "Application",
  "Job",
  "ScrapeRun",
  "CareerSource",
  "Company",
  "User",
];

/** Wipes every table between tests so each one starts from a clean slate. CASCADE + listing
 * every table means FK order doesn't matter; RESTART IDENTITY isn't needed since every id here
 * is a cuid(), not a serial. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE;`);
}

export function createTestCompany(overrides: Partial<Prisma.CompanyUncheckedCreateInput> = {}) {
  return prisma.company.create({
    data: { name: "Test Co", ...overrides },
  });
}

export function createTestCareerSource(
  companyId: string,
  overrides: Partial<Prisma.CareerSourceUncheckedCreateInput> = {},
) {
  return prisma.careerSource.create({
    data: { companyId, url: "https://example.com/jobs", sourceType: "CUSTOM_HTML", ...overrides },
  });
}
