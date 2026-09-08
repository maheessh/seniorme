import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@ccc/db";
import { encode } from "next-auth/jwt";

// Truncates and reseeds the ccc_test database with deterministic fixture data for the E2E
// suite, then mints a signed session for the fixture user and writes it as Playwright storage
// state — every spec starts already signed in, without driving a real Google/GitHub OAuth
// flow (see e2e/README-ish comment in playwright.config.ts for how storageState is wired in).
//
// Deliberately does NOT go through the real scraper — a real scrape depends on live external
// sites and network conditions, which would make the E2E suite flaky and slow. Instead this
// seeds the *result* a successful scrape would produce (a Job row, with this user's own
// UserJobStatus NEW), so the tests can exercise this app's own UI/data flow (triage, pipeline,
// Kanban, projects/goals) deterministically. The scraper itself is covered by packages/scraper's
// unit tests and apps/worker's integration tests, which is where "does scraping actually work"
// belongs.

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

const SESSION_COOKIE_NAME = "authjs.session-token";
const STORAGE_STATE_PATH = path.resolve(__dirname, ".auth/user.json");

async function writeStorageState(user: { id: string; email: string; name: string | null }) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set to mint an E2E session");

  const token = await encode({
    secret,
    salt: SESSION_COOKIE_NAME,
    token: { sub: user.id, uid: user.id, email: user.email, name: user.name },
  });

  mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  writeFileSync(
    STORAGE_STATE_PATH,
    JSON.stringify({
      cookies: [
        {
          name: SESSION_COOKIE_NAME,
          value: token,
          domain: "localhost",
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
}

async function main() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE;`);

  const user = await prisma.user.create({
    data: { email: "e2e-fixture@example.com", name: "E2E Fixture User" },
  });

  async function trackCompany(
    name: string,
    prefs: { priority: "LOW" | "MEDIUM" | "HIGH" },
  ) {
    const company = await prisma.company.create({ data: { name } });
    await prisma.userCompany.create({ data: { userId: user.id, companyId: company.id, ...prefs } });
    return company;
  }

  async function createJobWithStatus(
    data: Parameters<typeof prisma.job.create>[0]["data"],
    status: "NEW" | "SAVED" | "APPLIED" | "IGNORED" = "NEW",
  ) {
    const job = await prisma.job.create({ data });
    await prisma.userJobStatus.create({ data: { userId: user.id, jobId: job.id, status } });
    return job;
  }

  const company = await trackCompany("Acme Corp", { priority: "HIGH" });
  await prisma.careerSource.create({
    data: { companyId: company.id, url: "https://boards.greenhouse.io/acme-e2e-fixture", sourceType: "GREENHOUSE" },
  });

  await createJobWithStatus({
    companyId: company.id,
    title: "Software Engineer, Platform",
    location: "Remote",
    workMode: "REMOTE",
    employmentType: "FULL_TIME",
    url: "https://boards.greenhouse.io/acme-e2e-fixture/jobs/1",
    canonicalUrlHash: "e2e-fixture-hash-1",
    externalJobId: "e2e-1",
    postedAt: new Date(),
  });

  // A second company with its own NEW job — needed so the Inbox company/employment-type filter
  // spec has something to actually narrow away, not just one company to (no-op) select.
  const secondCompany = await trackCompany("Initech", { priority: "MEDIUM" });
  await createJobWithStatus({
    companyId: secondCompany.id,
    title: "Data Analyst Intern",
    location: "Austin, TX",
    workMode: "ONSITE",
    employmentType: "INTERNSHIP",
    url: "https://boards.greenhouse.io/initech-e2e-fixture/jobs/1",
    canonicalUrlHash: "e2e-fixture-hash-3",
    externalJobId: "e2e-3",
    postedAt: new Date(),
  });

  // A third company with two of its own NEW jobs, dedicated to the bulk-select spec — that test
  // filters down to just this company and bulk-ignores everything it finds, which would
  // otherwise permanently consume "Software Engineer, Platform"/"Data Analyst Intern" (globalSetup
  // seeds once for the whole run, not per test file) and break every other spec that expects
  // those two to still be sitting in New.
  const thirdCompany = await trackCompany("Vandelay Industries", { priority: "LOW" });
  await createJobWithStatus({
    companyId: thirdCompany.id,
    title: "QA Engineer",
    location: "Chicago, IL",
    workMode: "ONSITE",
    employmentType: "FULL_TIME",
    url: "https://boards.greenhouse.io/vandelay-e2e-fixture/jobs/1",
    canonicalUrlHash: "e2e-fixture-hash-4",
    externalJobId: "e2e-4",
    postedAt: new Date(),
  });
  await createJobWithStatus({
    companyId: thirdCompany.id,
    title: "DevOps Engineer",
    location: "Chicago, IL",
    workMode: "ONSITE",
    employmentType: "FULL_TIME",
    url: "https://boards.greenhouse.io/vandelay-e2e-fixture/jobs/2",
    canonicalUrlHash: "e2e-fixture-hash-5",
    externalJobId: "e2e-5",
    postedAt: new Date(),
  });

  // A fourth company, separate from Vandelay above — the bulk-select spec's *other* test
  // (checking the indeterminate "select all" state) only deselects one job rather than
  // bulk-ignoring, but still needs its own untouched pair so test declaration order within the
  // file can't make it see jobs the first test already ignored.
  const fourthCompany = await trackCompany("Sterling Cooper", { priority: "LOW" });
  await createJobWithStatus({
    companyId: fourthCompany.id,
    title: "Support Engineer",
    location: "Chicago, IL",
    workMode: "ONSITE",
    employmentType: "FULL_TIME",
    url: "https://boards.greenhouse.io/sterling-cooper-e2e-fixture/jobs/1",
    canonicalUrlHash: "e2e-fixture-hash-6",
    externalJobId: "e2e-6",
    postedAt: new Date(),
  });
  await createJobWithStatus({
    companyId: fourthCompany.id,
    title: "Backend Engineer, Platform",
    location: "Chicago, IL",
    workMode: "ONSITE",
    employmentType: "FULL_TIME",
    url: "https://boards.greenhouse.io/sterling-cooper-e2e-fixture/jobs/2",
    canonicalUrlHash: "e2e-fixture-hash-7",
    externalJobId: "e2e-7",
    postedAt: new Date(),
  });

  const pipelineJob = await createJobWithStatus(
    {
      companyId: company.id,
      title: "Senior Backend Engineer",
      location: "New York, NY",
      workMode: "ONSITE",
      url: "https://boards.greenhouse.io/acme-e2e-fixture/jobs/2",
      canonicalUrlHash: "e2e-fixture-hash-2",
      externalJobId: "e2e-2",
      postedAt: new Date(),
    },
    "APPLIED",
  );
  const application = await prisma.application.create({
    data: { jobId: pipelineJob.id, companyId: company.id, userId: user.id, stage: "APPLIED", appliedAt: new Date() },
  });
  await prisma.applicationEvent.create({
    data: { applicationId: application.id, fromStage: null, toStage: "APPLIED" },
  });

  await prisma.project.create({
    data: { userId: user.id, name: "Portfolio Site", status: "BUILDING", priority: "MEDIUM", progressPercent: 40 },
  });

  await prisma.goal.create({
    data: { userId: user.id, title: "Apply to 20 jobs", category: "APPLICATIONS", targetValue: 20, currentValue: 5 },
  });

  await writeStorageState(user);

  console.log("E2E fixture data seeded.");
}

main()
  .catch((error) => {
    console.error("E2E seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
