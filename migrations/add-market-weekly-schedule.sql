-- ============================================
-- ADD WEEKLY SCHEDULE TO MARKET TABLE
-- ============================================
-- Description: Adds weeklySchedule field to Market table for business hours
-- Date: 2026-01-XX
-- Author: Job Portal Team
--
-- This migration adds:
-- 1. weeklySchedule JSONB field to Market table for storing business hours
--    (when the service/market is open or closed)
--
-- IMPORTANT: Backup your database before running this migration!
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Add weeklySchedule column to Market table
-- ============================================
ALTER TABLE "Market" 
ADD COLUMN IF NOT EXISTS "weeklySchedule" JSONB;

-- Add comment to the column
COMMENT ON COLUMN "Market"."weeklySchedule" IS 'Recurring weekly schedule for business hours. Stores day-by-day availability with work hours in JSON format. Defines when the service/market is open or closed.';

COMMIT;

-- ============================================
-- Migration completed successfully!
-- ============================================
-- Next steps:
-- 1. Run: npx prisma generate (to update Prisma Client)
-- 2. Test the business hours feature
-- ============================================
