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
  "UserJobStatus",
  "Job",
  "ScrapeRun",
  "CareerSource",
  "UserCompany",
  "Company",
  "Account",
  "User",
];

/** Wipes every table between tests so each one starts from a clean slate. CASCADE + listing
 * every table means FK order doesn't matter; RESTART IDENTITY isn't needed since every id here
 * is a cuid(), not a serial. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE;`);
}

export function createTestUser(overrides: Partial<Prisma.UserUncheckedCreateInput> = {}) {
  return prisma.user.create({
    data: { email: `test-${Math.random().toString(36).slice(2)}@example.com`, ...overrides },
  });
}

export function createTestCompany(overrides: Partial<Prisma.CompanyUncheckedCreateInput> = {}) {
  return prisma.company.create({
    data: { name: "Test Co", ...overrides },
  });
}

/** Tracks a company for a user — the multi-tenant equivalent of the old "company preferences"
 * fields, now stored as a UserCompany row instead of directly on Company. */
export function createTestUserCompany(
  userId: string,
  companyId: string,
  overrides: Partial<Prisma.UserCompanyUncheckedCreateInput> = {},
) {
  return prisma.userCompany.create({
    data: { userId, companyId, ...overrides },
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
