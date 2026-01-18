-- AlterTable: Add checkinRequiresApproval field to Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "checkinRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN "Order"."checkinRequiresApproval" IS 'If true, bookings for this order require owner approval before being confirmed';
