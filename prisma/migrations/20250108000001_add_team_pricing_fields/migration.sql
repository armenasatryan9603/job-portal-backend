-- AlterTable: Add team pricing fields to OrderPricing
ALTER TABLE "OrderPricing" ADD COLUMN IF NOT EXISTS "teamCreditCost" DOUBLE PRECISION;
ALTER TABLE "OrderPricing" ADD COLUMN IF NOT EXISTS "teamRefundPercentage" DOUBLE PRECISION;

-- Set default teamRefundPercentage to 0.5 for existing records
UPDATE "OrderPricing" SET "teamRefundPercentage" = 0.5 WHERE "teamRefundPercentage" IS NULL;

