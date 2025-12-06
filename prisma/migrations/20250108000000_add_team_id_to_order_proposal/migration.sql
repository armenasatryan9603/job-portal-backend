-- AlterTable: Add teamId to OrderProposal
ALTER TABLE "OrderProposal" ADD COLUMN IF NOT EXISTS "teamId" INTEGER;

-- AddForeignKey
ALTER TABLE "OrderProposal" ADD CONSTRAINT "OrderProposal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

