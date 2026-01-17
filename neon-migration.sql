-- ============================================
-- NEON DB MIGRATION: Permanent Orders Feature
-- ============================================
-- Description: Adds support for permanent/recurring orders with booking system
-- Date: 2026-01-15
-- Author: Job Portal Team
--
-- This migration adds:
-- 1. orderType field to Order table (one_time/permanent)
-- 2. workDurationPerClient field to Order table
-- 3. weeklySchedule field to Order table (recurring schedule)
-- 4. New Booking table for tracking check-ins
-- 5. Indexes for performance optimization
-- 6. Foreign key constraints for data integrity
--
-- IMPORTANT: Backup your database before running this migration!
-- ============================================

-- Start transaction for atomicity
BEGIN;

-- ============================================
-- STEP 1: Add new columns to Order table
-- ============================================
ALTER TABLE "Order" 
  ADD COLUMN IF NOT EXISTS "orderType" TEXT NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS "workDurationPerClient" INTEGER,
  ADD COLUMN IF NOT EXISTS "weeklySchedule" JSONB;

-- Add comment to explain the columns
COMMENT ON COLUMN "Order"."orderType" IS 'Type of order: one_time or permanent';
COMMENT ON COLUMN "Order"."workDurationPerClient" IS 'Duration in minutes for each appointment (permanent orders only)';
COMMENT ON COLUMN "Order"."weeklySchedule" IS 'Recurring weekly schedule for permanent orders. Stores day-by-day availability with work hours and time slots in JSON format.';

-- ============================================
-- STEP 2: Create index on orderType for filtering
-- ============================================
CREATE INDEX IF NOT EXISTS "Order_orderType_idx" ON "Order"("orderType");

-- ============================================
-- STEP 3: Create Booking table
-- ============================================
CREATE TABLE IF NOT EXISTS "Booking" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- Add comments to explain the Booking table
COMMENT ON TABLE "Booking" IS 'Stores check-in bookings for permanent orders';
COMMENT ON COLUMN "Booking"."status" IS 'Booking status: confirmed, completed, or cancelled';

-- ============================================
-- STEP 4: Create indexes on Booking table
-- ============================================
CREATE INDEX IF NOT EXISTS "Booking_orderId_idx" ON "Booking"("orderId");
CREATE INDEX IF NOT EXISTS "Booking_clientId_idx" ON "Booking"("clientId");
CREATE INDEX IF NOT EXISTS "Booking_scheduledDate_idx" ON "Booking"("scheduledDate");
CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status");

-- Composite index for common queries (finding available slots)
CREATE INDEX IF NOT EXISTS "Booking_orderId_scheduledDate_idx" ON "Booking"("orderId", "scheduledDate");

-- ============================================
-- STEP 5: Add foreign key constraints
-- ============================================

-- Link Booking to Order (cascade delete - if order deleted, bookings are deleted)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Booking_orderId_fkey'
    ) THEN
        ALTER TABLE "Booking" 
            ADD CONSTRAINT "Booking_orderId_fkey" 
            FOREIGN KEY ("orderId") 
            REFERENCES "Order"("id") 
            ON DELETE CASCADE 
            ON UPDATE CASCADE;
    END IF;
END $$;

-- Link Booking to User/Client (restrict delete - cannot delete user with bookings)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Booking_clientId_fkey'
    ) THEN
        ALTER TABLE "Booking" 
            ADD CONSTRAINT "Booking_clientId_fkey" 
            FOREIGN KEY ("clientId") 
            REFERENCES "User"("id") 
            ON DELETE RESTRICT 
            ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================
-- STEP 6: Create trigger for updatedAt timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_booking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_booking_timestamp ON "Booking";
CREATE TRIGGER update_booking_timestamp
    BEFORE UPDATE ON "Booking"
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_updated_at();

-- ============================================
-- STEP 7: Verify migration
-- ============================================

-- Check that new columns exist in Order table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Order' 
          AND column_name = 'orderType'
    ) THEN
        RAISE EXCEPTION 'Migration failed: orderType column not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Order' 
          AND column_name = 'workDurationPerClient'
    ) THEN
        RAISE EXCEPTION 'Migration failed: workDurationPerClient column not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Order' 
          AND column_name = 'weeklySchedule'
    ) THEN
        RAISE EXCEPTION 'Migration failed: weeklySchedule column not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Booking'
    ) THEN
        RAISE EXCEPTION 'Migration failed: Booking table not created';
    END IF;

    RAISE NOTICE 'Migration completed successfully!';
END $$;

-- Commit transaction
COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify the changes with these queries:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'Order' 
--   AND column_name IN ('orderType', 'workDurationPerClient', 'weeklySchedule');

-- SELECT * FROM "Booking" LIMIT 0;
-- (This should show the table structure without data)
