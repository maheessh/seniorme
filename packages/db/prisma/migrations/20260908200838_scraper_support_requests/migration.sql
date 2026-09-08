-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SCRAPER_REQUEST_RESOLVED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ScraperSupportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "careerSourceId" TEXT,
    "companyName" TEXT NOT NULL,
    "domain" TEXT,
    "website" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "errorMessage" TEXT,
    "note" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ScraperSupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScraperSupportRequest_status_createdAt_idx" ON "ScraperSupportRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScraperSupportRequest_userId_idx" ON "ScraperSupportRequest"("userId");

-- AddForeignKey
ALTER TABLE "ScraperSupportRequest" ADD CONSTRAINT "ScraperSupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperSupportRequest" ADD CONSTRAINT "ScraperSupportRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperSupportRequest" ADD CONSTRAINT "ScraperSupportRequest_careerSourceId_fkey" FOREIGN KEY ("careerSourceId") REFERENCES "CareerSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Promote the existing local admin user by email (no-op on a fresh prod DB where this row
-- doesn't exist yet — the ADMIN_EMAILS allowlist in auth.ts promotes on sign-in there).
UPDATE "User" SET "isAdmin" = true WHERE "email" = 'mahesh.pandit@selu.edu';
