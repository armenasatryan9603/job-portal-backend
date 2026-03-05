-- Backfill TopData.action to avoid NULLs breaking enum serialization

-- Ensure default is set for new rows
ALTER TABLE "TopData" ALTER COLUMN "action" SET DEFAULT 'open';

-- Backfill existing rows that currently have NULL action
UPDATE "TopData"
SET "action" = 'open'
WHERE "action" IS NULL;

