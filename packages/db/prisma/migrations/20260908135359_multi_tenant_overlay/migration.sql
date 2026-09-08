-- Multi-tenant Phase 1: split shared catalog (Company/Job) from per-user overlay
-- (UserCompany/UserJobStatus), and give Application/Contact/Project/Goal/Notification a real
-- owner. Existing data is preserved and backfilled onto the first real user
-- (cmtspy36r0000rxuu0qu5k8qm).

-- ===== 1. New per-user overlay tables =====

CREATE TABLE "UserCompany" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "rolesOfInterest" TEXT[],
    "targetLocationKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxPostingAgeDays" INTEGER,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserJobStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "InboxStatus" NOT NULL DEFAULT 'NEW',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserJobStatus_pkey" PRIMARY KEY ("id")
);

-- ===== 2. Backfill the overlay tables from today's shared Company/Job data, onto the first
--          real signed-in user =====

INSERT INTO "UserCompany"
  ("id", "userId", "companyId", "priority", "notes", "rolesOfInterest", "targetLocationKeywords",
   "maxPostingAgeDays", "monitoringEnabled", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'cmtspy36r0000rxuu0qu5k8qm', "id", "priority", "notes",
       "rolesOfInterest", "targetLocationKeywords", "maxPostingAgeDays", "monitoringEnabled",
       "createdAt", "updatedAt"
FROM "Company";

INSERT INTO "UserJobStatus" ("id", "userId", "jobId", "status", "updatedAt")
SELECT gen_random_uuid()::text, 'cmtspy36r0000rxuu0qu5k8qm', "id", "inboxStatus", "updatedAt"
FROM "Job";

-- ===== 3. Add userId to directly-owned tables, backfill, then require it =====

ALTER TABLE "Application" ADD COLUMN "userId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "userId" TEXT;
ALTER TABLE "Project" ADD COLUMN "userId" TEXT;
ALTER TABLE "Goal" ADD COLUMN "userId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "userId" TEXT;
ALTER TABLE "ActivityEvent" ADD COLUMN "userId" TEXT;

UPDATE "Application" SET "userId" = 'cmtspy36r0000rxuu0qu5k8qm';
UPDATE "Contact" SET "userId" = 'cmtspy36r0000rxuu0qu5k8qm';
UPDATE "Project" SET "userId" = 'cmtspy36r0000rxuu0qu5k8qm';
UPDATE "Goal" SET "userId" = 'cmtspy36r0000rxuu0qu5k8qm';
UPDATE "Notification" SET "userId" = 'cmtspy36r0000rxuu0qu5k8qm';
-- Only personal ActivityEvent types get an owner — job_discovered/job_updated are system
-- events about the shared catalog and stay unowned (userId NULL).
UPDATE "ActivityEvent" SET "userId" = 'cmtspy36r0000rxuu0qu5k8qm'
WHERE "type" IN ('job_status_changed', 'application_created', 'application_stage_changed', 'job_imported');

ALTER TABLE "Application" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Contact" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Goal" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "userId" SET NOT NULL;

-- ===== 4. Drop indexes/constraints that no longer make sense =====

DROP INDEX "Application_jobId_key";
DROP INDEX "Application_stage_idx";
DROP INDEX "Job_companyId_inboxStatus_idx";
DROP INDEX "Job_inboxStatus_updatedAt_idx";
DROP INDEX "Notification_dedupeKey_key";
DROP INDEX "Notification_isRead_createdAt_idx";

-- ===== 5. Drop the now-migrated columns from the shared catalog tables =====

ALTER TABLE "Company" DROP COLUMN "maxPostingAgeDays",
DROP COLUMN "monitoringEnabled",
DROP COLUMN "notes",
DROP COLUMN "priority",
DROP COLUMN "rolesOfInterest",
DROP COLUMN "targetLocationKeywords";

ALTER TABLE "Job" DROP COLUMN "inboxStatus";

-- ===== 6. New indexes =====

CREATE INDEX "UserCompany_companyId_idx" ON "UserCompany"("companyId");
CREATE UNIQUE INDEX "UserCompany_userId_companyId_key" ON "UserCompany"("userId", "companyId");

CREATE INDEX "UserJobStatus_userId_status_idx" ON "UserJobStatus"("userId", "status");
CREATE INDEX "UserJobStatus_status_updatedAt_idx" ON "UserJobStatus"("status", "updatedAt");
CREATE UNIQUE INDEX "UserJobStatus_userId_jobId_key" ON "UserJobStatus"("userId", "jobId");

CREATE INDEX "ActivityEvent_userId_occurredAt_idx" ON "ActivityEvent"("userId", "occurredAt");

CREATE INDEX "Application_userId_stage_idx" ON "Application"("userId", "stage");
CREATE UNIQUE INDEX "Application_userId_jobId_key" ON "Application"("userId", "jobId");

CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- ===== 7. Foreign keys =====

ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserJobStatus" ADD CONSTRAINT "UserJobStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserJobStatus" ADD CONSTRAINT "UserJobStatus_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
