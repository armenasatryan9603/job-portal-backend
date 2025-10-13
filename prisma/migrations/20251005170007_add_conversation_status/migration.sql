-- AlterTable
ALTER TABLE "public"."Conversation" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "public"."Conversation"("status");
