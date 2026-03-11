-- AlterTable: Add birthday to User
ALTER TABLE "User" ADD COLUMN "birthday" TIMESTAMP(3);

-- AlterTable: Add anniversaryDate to Couple
ALTER TABLE "Couple" ADD COLUMN "anniversaryDate" TIMESTAMP(3);

-- AlterTable: Add nickname to CoupleMember
ALTER TABLE "CoupleMember" ADD COLUMN "nickname" TEXT;

-- CreateIndex: Composite index for event queries by couple and appointment time
CREATE INDEX "CalendarEvent_coupleId_appointmentAt_idx" ON "CalendarEvent"("coupleId", "appointmentAt");
