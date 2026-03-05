-- Create enum type for TopData.action
DO $$ BEGIN
  CREATE TYPE "TopDataAction" AS ENUM ('open', 'external', 'apply', 'book');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add action column to TopData table (nullable, with default 'open' for new rows)
ALTER TABLE "TopData" ADD COLUMN IF NOT EXISTS "action" "TopDataAction";
ALTER TABLE "TopData" ALTER COLUMN "action" SET DEFAULT 'open';

-- Index for faster filtering by action
CREATE INDEX IF NOT EXISTS "TopData_action_idx" ON "TopData"("action");

