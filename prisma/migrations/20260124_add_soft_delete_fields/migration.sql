-- AlterTable: Add deletedAt field to User table for soft deletion
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: Add deletedAt field to Order table for soft deletion
ALTER TABLE "Order" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex: Add index on User.deletedAt for faster filtering
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex: Add index on Order.deletedAt for faster filtering
CREATE INDEX "Order_deletedAt_idx" ON "Order"("deletedAt");
