-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "maxPostingAgeDays" INTEGER,
ADD COLUMN     "targetLocationKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
