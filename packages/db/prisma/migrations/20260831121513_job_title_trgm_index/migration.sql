-- CreateIndex
CREATE INDEX "Job_title_idx" ON "Job" USING GIN ("title" gin_trgm_ops);
