-- Migration: Remove skills column from Order table
-- Run this migration AFTER verifying that all skills have been migrated to Skill/OrderSkill tables
-- DO NOT run this until you have verified the data migration is complete

-- Step 1: Verify that all skills have been migrated
-- Run this query first to check:
-- SELECT 
--     (SELECT COUNT(*) FROM "Order" WHERE skills IS NOT NULL AND array_length(skills, 1) > 0) as orders_with_skills,
--     (SELECT COUNT(DISTINCT "orderId") FROM "OrderSkill") as orders_with_migrated_skills;

-- Step 2: Remove the skills column from Order table
ALTER TABLE "Order" DROP COLUMN IF EXISTS "skills";

-- Step 3: Verify removal
-- Run this query to confirm:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'Order' AND column_name = 'skills';
-- Should return 0 rows

