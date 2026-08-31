-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'ICIMS';

-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "updatedAt" DROP DEFAULT;
