-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_possibleDuplicateOfId_fkey" FOREIGN KEY ("possibleDuplicateOfId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
