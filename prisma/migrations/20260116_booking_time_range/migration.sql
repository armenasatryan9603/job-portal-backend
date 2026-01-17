-- AlterTable: Add startTime and endTime columns to Booking table
ALTER TABLE "Booking" ADD COLUMN "startTime" TEXT;
ALTER TABLE "Booking" ADD COLUMN "endTime" TEXT;

-- Migrate existing data: split "09:00-09:50" format into startTime and endTime
UPDATE "Booking" 
SET 
  "startTime" = SPLIT_PART("scheduledTime", '-', 1),
  "endTime" = SPLIT_PART("scheduledTime", '-', 2)
WHERE "scheduledTime" LIKE '%-%';

-- Handle any bookings that don't have the hyphen format (shouldn't exist, but safety)
UPDATE "Booking"
SET
  "startTime" = "scheduledTime",
  "endTime" = "scheduledTime"
WHERE "startTime" IS NULL;

-- Make columns NOT NULL after migration
ALTER TABLE "Booking" ALTER COLUMN "startTime" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "endTime" SET NOT NULL;

-- Drop old column
ALTER TABLE "Booking" DROP COLUMN "scheduledTime";
