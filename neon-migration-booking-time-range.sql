-- Migration: Convert Booking.scheduledTime to startTime/endTime
-- Date: 2026-01-16
-- Description: Refactor booking system to support continuous time ranges instead of predefined slots

-- STEP 1: Add new columns
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "startTime" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "endTime" TEXT;

-- STEP 2: Migrate existing data
-- Split "09:00-09:50" format into separate startTime and endTime columns
UPDATE "Booking" 
SET 
  "startTime" = SPLIT_PART("scheduledTime", '-', 1),
  "endTime" = SPLIT_PART("scheduledTime", '-', 2)
WHERE "scheduledTime" LIKE '%-%' 
  AND ("startTime" IS NULL OR "endTime" IS NULL);

-- Handle edge case: bookings without hyphen format
UPDATE "Booking"
SET
  "startTime" = "scheduledTime",
  "endTime" = "scheduledTime"
WHERE "startTime" IS NULL OR "endTime" IS NULL;

-- STEP 3: Verify migration
-- Check for any NULL values (should return 0)
SELECT COUNT(*) as null_count FROM "Booking" 
WHERE "startTime" IS NULL OR "endTime" IS NULL;

-- STEP 4: Make columns NOT NULL
ALTER TABLE "Booking" ALTER COLUMN "startTime" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "endTime" SET NOT NULL;

-- STEP 5: Drop old column
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "scheduledTime";

-- STEP 6: Verify final state
SELECT 
  id, 
  "scheduledDate", 
  "startTime", 
  "endTime", 
  status 
FROM "Booking" 
LIMIT 5;

-- Migration complete!
-- All bookings now use startTime/endTime format for flexible time range booking
