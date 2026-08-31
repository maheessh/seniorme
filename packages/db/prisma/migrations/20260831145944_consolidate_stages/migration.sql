-- Consolidate InboxStatus (drop INTERESTED, NOT_INTERESTED — merged into SAVED / IGNORED)
-- and ApplicationStage (drop DISCOVERED — unreachable, Applications are only ever created at
-- APPLIED; rename INTERESTED -> SAVED for naming consistency with the Inbox). Existing rows
-- using a removed/renamed value are remapped via the CASE expression in each USING clause,
-- rather than a separate data-migration step, so the type swap and the remap happen atomically.

-- AlterEnum: ApplicationStage
BEGIN;
CREATE TYPE "ApplicationStage_new" AS ENUM ('SAVED', 'PREPARING', 'APPLIED', 'OA', 'RECRUITER_SCREEN', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'CLOSED');
ALTER TABLE "Application" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Application" ALTER COLUMN "stage" TYPE "ApplicationStage_new" USING (
  CASE "stage"::text
    WHEN 'DISCOVERED' THEN 'SAVED'
    WHEN 'INTERESTED' THEN 'SAVED'
    ELSE "stage"::text
  END
)::"ApplicationStage_new";
ALTER TABLE "ApplicationEvent" ALTER COLUMN "fromStage" TYPE "ApplicationStage_new" USING (
  CASE "fromStage"::text
    WHEN 'DISCOVERED' THEN 'SAVED'
    WHEN 'INTERESTED' THEN 'SAVED'
    ELSE "fromStage"::text
  END
)::"ApplicationStage_new";
ALTER TABLE "ApplicationEvent" ALTER COLUMN "toStage" TYPE "ApplicationStage_new" USING (
  CASE "toStage"::text
    WHEN 'DISCOVERED' THEN 'SAVED'
    WHEN 'INTERESTED' THEN 'SAVED'
    ELSE "toStage"::text
  END
)::"ApplicationStage_new";
ALTER TYPE "ApplicationStage" RENAME TO "ApplicationStage_old";
ALTER TYPE "ApplicationStage_new" RENAME TO "ApplicationStage";
DROP TYPE "ApplicationStage_old";
ALTER TABLE "Application" ALTER COLUMN "stage" SET DEFAULT 'SAVED';
COMMIT;

-- AlterEnum: InboxStatus
BEGIN;
CREATE TYPE "InboxStatus_new" AS ENUM ('NEW', 'SAVED', 'APPLIED', 'IGNORED');
ALTER TABLE "Job" ALTER COLUMN "inboxStatus" DROP DEFAULT;
ALTER TABLE "Job" ALTER COLUMN "inboxStatus" TYPE "InboxStatus_new" USING (
  CASE "inboxStatus"::text
    WHEN 'INTERESTED' THEN 'SAVED'
    WHEN 'NOT_INTERESTED' THEN 'IGNORED'
    ELSE "inboxStatus"::text
  END
)::"InboxStatus_new";
ALTER TYPE "InboxStatus" RENAME TO "InboxStatus_old";
ALTER TYPE "InboxStatus_new" RENAME TO "InboxStatus";
DROP TYPE "InboxStatus_old";
ALTER TABLE "Job" ALTER COLUMN "inboxStatus" SET DEFAULT 'NEW';
COMMIT;

-- AlterTable: Job.updatedAt (backfilled with now() for existing rows; Prisma's @updatedAt
-- manages the value client-side on every future write, this default just satisfies NOT NULL
-- for rows that already exist)
ALTER TABLE "Job" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Job_inboxStatus_updatedAt_idx" ON "Job"("inboxStatus", "updatedAt");
