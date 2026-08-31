-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT;

-- CreateIndex
CREATE INDEX "Application_followUpDate_idx" ON "Application"("followUpDate");

-- CreateIndex
CREATE INDEX "ApplicationEvent_scheduledAt_idx" ON "ApplicationEvent"("scheduledAt");

-- CreateIndex
CREATE INDEX "Goal_deadline_idx" ON "Goal"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

