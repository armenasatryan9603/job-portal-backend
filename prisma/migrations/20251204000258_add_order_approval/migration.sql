-- AlterTable
ALTER TABLE "Order" ADD COLUMN "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- Keep existing "open" orders as "open" (no migration needed)
-- New orders will start as "pending_review" and become "open" when approved

