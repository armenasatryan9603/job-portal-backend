-- AlterTable
ALTER TABLE "Message" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

