import { prisma } from "@ccc/db";

// Truncates and reseeds the ccc_test database with deterministic fixture data for the E2E
// suite. Deliberately does NOT go through the real scraper — a real scrape depends on live
// external sites and network conditions, which would make the E2E suite flaky and slow. Instead
// this seeds the *result* a successful scrape would produce (a Job row with NEW status), so the
// tests can exercise this app's own UI/data flow (triage, pipeline, Kanban, projects/goals)
// deterministically. The scraper itself is covered by packages/scraper's unit tests and
// apps/worker's integration tests, which is where "does scraping actually work" belongs.

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
];

async function main() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE;`);

  const company = await prisma.company.create({
    data: { name: "Acme Corp", priority: "HIGH", monitoringEnabled: true },
  });
  await prisma.careerSource.create({
    data: { companyId: company.id, url: "https://boards.greenhouse.io/acme-e2e-fixture", sourceType: "GREENHOUSE" },
  });

  await prisma.job.create({
    data: {
      companyId: company.id,
      title: "Software Engineer, Platform",
      location: "Remote",
      workMode: "REMOTE",
      employmentType: "FULL_TIME",
      url: "https://boards.greenhouse.io/acme-e2e-fixture/jobs/1",
      canonicalUrlHash: "e2e-fixture-hash-1",
      externalJobId: "e2e-1",
      inboxStatus: "NEW",
      postedAt: new Date(),
    },
  });

  // A second company with its own NEW job — needed so the Inbox company/employment-type filter
  // spec has something to actually narrow away, not just one company to (no-op) select.
  const secondCompany = await prisma.company.create({
    data: { name: "Initech", priority: "MEDIUM", monitoringEnabled: true },
  });
  await prisma.job.create({
    data: {
      companyId: secondCompany.id,
      title: "Data Analyst Intern",
      location: "Austin, TX",
      workMode: "ONSITE",
      employmentType: "INTERNSHIP",
      url: "https://boards.greenhouse.io/initech-e2e-fixture/jobs/1",
      canonicalUrlHash: "e2e-fixture-hash-3",
      externalJobId: "e2e-3",
      inboxStatus: "NEW",
      postedAt: new Date(),
    },
  });

  // A third company with two of its own NEW jobs, dedicated to the bulk-select spec — that test
  // filters down to just this company and bulk-ignores everything it finds, which would
  // otherwise permanently consume "Software Engineer, Platform"/"Data Analyst Intern" (globalSetup
  // seeds once for the whole run, not per test file) and break every other spec that expects
  // those two to still be sitting in New.
  const thirdCompany = await prisma.company.create({
    data: { name: "Vandelay Industries", priority: "LOW", monitoringEnabled: true },
  });
  await prisma.job.create({
    data: {
      companyId: thirdCompany.id,
      title: "QA Engineer",
      location: "Chicago, IL",
      workMode: "ONSITE",
      employmentType: "FULL_TIME",
      url: "https://boards.greenhouse.io/vandelay-e2e-fixture/jobs/1",
      canonicalUrlHash: "e2e-fixture-hash-4",
      externalJobId: "e2e-4",
      inboxStatus: "NEW",
      postedAt: new Date(),
    },
  });
  await prisma.job.create({
    data: {
      companyId: thirdCompany.id,
      title: "DevOps Engineer",
      location: "Chicago, IL",
      workMode: "ONSITE",
      employmentType: "FULL_TIME",
      url: "https://boards.greenhouse.io/vandelay-e2e-fixture/jobs/2",
      canonicalUrlHash: "e2e-fixture-hash-5",
      externalJobId: "e2e-5",
      inboxStatus: "NEW",
      postedAt: new Date(),
    },
  });

  // A fourth company, separate from Vandelay above — the bulk-select spec's *other* test
  // (checking the indeterminate "select all" state) only deselects one job rather than
  // bulk-ignoring, but still needs its own untouched pair so test declaration order within the
  // file can't make it see jobs the first test already ignored.
  const fourthCompany = await prisma.company.create({
    data: { name: "Sterling Cooper", priority: "LOW", monitoringEnabled: true },
  });
  await prisma.job.create({
    data: {
      companyId: fourthCompany.id,
      title: "Support Engineer",
      location: "Chicago, IL",
      workMode: "ONSITE",
      employmentType: "FULL_TIME",
      url: "https://boards.greenhouse.io/sterling-cooper-e2e-fixture/jobs/1",
      canonicalUrlHash: "e2e-fixture-hash-6",
      externalJobId: "e2e-6",
      inboxStatus: "NEW",
      postedAt: new Date(),
    },
  });
  await prisma.job.create({
    data: {
      companyId: fourthCompany.id,
      title: "Backend Engineer, Platform",
      location: "Chicago, IL",
      workMode: "ONSITE",
      employmentType: "FULL_TIME",
      url: "https://boards.greenhouse.io/sterling-cooper-e2e-fixture/jobs/2",
      canonicalUrlHash: "e2e-fixture-hash-7",
      externalJobId: "e2e-7",
      inboxStatus: "NEW",
      postedAt: new Date(),
    },
  });

  const pipelineJob = await prisma.job.create({
    data: {
      companyId: company.id,
      title: "Senior Backend Engineer",
      location: "New York, NY",
      workMode: "ONSITE",
      url: "https://boards.greenhouse.io/acme-e2e-fixture/jobs/2",
      canonicalUrlHash: "e2e-fixture-hash-2",
      externalJobId: "e2e-2",
      inboxStatus: "APPLIED",
      postedAt: new Date(),
    },
  });
  const application = await prisma.application.create({
    data: { jobId: pipelineJob.id, companyId: company.id, stage: "APPLIED", appliedAt: new Date() },
  });
  await prisma.applicationEvent.create({
    data: { applicationId: application.id, fromStage: null, toStage: "APPLIED" },
  });

  await prisma.project.create({
    data: { name: "Portfolio Site", status: "BUILDING", priority: "MEDIUM", progressPercent: 40 },
  });

  await prisma.goal.create({
    data: { title: "Apply to 20 jobs", category: "APPLICATIONS", targetValue: 20, currentValue: 5 },
  });

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
