-- ============================================================
-- Skills Management System Migration for Neon DB
-- ============================================================
-- This SQL script migrates skills from Order.skills array to 
-- a full Skill and OrderSkill table structure.
--
-- IMPORTANT: 
-- 1. Backup your database before running this migration
-- 2. Run this in a transaction to ensure atomicity
-- 3. Verify the migration results before committing
-- 4. For Neon DB, you can run this via:
--    - Neon Console SQL Editor
--    - psql with connection string
--    - Neon CLI
-- ============================================================

BEGIN;

-- ============================================================
-- Step 1: Create Skill table
-- ============================================================
CREATE TABLE IF NOT EXISTS "Skill" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameHy" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionRu" TEXT,
    "descriptionHy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- Step 2: Create indexes on Skill table for search performance
-- ============================================================
CREATE INDEX IF NOT EXISTS "Skill_nameEn_idx" ON "Skill"("nameEn");
CREATE INDEX IF NOT EXISTS "Skill_nameRu_idx" ON "Skill"("nameRu");
CREATE INDEX IF NOT EXISTS "Skill_nameHy_idx" ON "Skill"("nameHy");

-- ============================================================
-- Step 3: Create OrderSkill junction table
-- ============================================================
CREATE TABLE IF NOT EXISTS "OrderSkill" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderSkill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderSkill_orderId_skillId_key" UNIQUE ("orderId", "skillId")
);

-- ============================================================
-- Step 4: Create indexes on OrderSkill table
-- ============================================================
CREATE INDEX IF NOT EXISTS "OrderSkill_orderId_idx" ON "OrderSkill"("orderId");
CREATE INDEX IF NOT EXISTS "OrderSkill_skillId_idx" ON "OrderSkill"("skillId");

-- ============================================================
-- Step 5: Add foreign key constraints
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'OrderSkill_orderId_fkey'
    ) THEN
        ALTER TABLE "OrderSkill" 
        ADD CONSTRAINT "OrderSkill_orderId_fkey" 
        FOREIGN KEY ("orderId") 
        REFERENCES "Order"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'OrderSkill_skillId_fkey'
    ) THEN
        ALTER TABLE "OrderSkill" 
        ADD CONSTRAINT "OrderSkill_skillId_fkey" 
        FOREIGN KEY ("skillId") 
        REFERENCES "Skill"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================
-- Step 6: Migrate existing skills data
-- ============================================================
-- This extracts unique skills from Order.skills array and creates Skill entries
-- Then creates OrderSkill entries linking orders to skills

DO $$
DECLARE
    order_record RECORD;
    skill_name TEXT;
    skill_id INTEGER;
    skill_array TEXT[];
    skill_item TEXT;
    skills_processed INTEGER := 0;
    skills_created INTEGER := 0;
    order_skills_created INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting skills migration...';
    
    -- Loop through all orders that have skills
    FOR order_record IN 
        SELECT id, skills 
        FROM "Order" 
        WHERE skills IS NOT NULL 
        AND array_length(skills, 1) > 0
    LOOP
        -- Process each skill in the array
        skill_array := order_record.skills;
        
        FOREACH skill_item IN ARRAY skill_array
        LOOP
            -- Trim whitespace
            skill_name := TRIM(skill_item);
            
            -- Skip empty strings
            IF skill_name = '' OR skill_name IS NULL THEN
                CONTINUE;
            END IF;
            
            skills_processed := skills_processed + 1;
            
            -- Check if skill already exists (case-insensitive)
            SELECT id INTO skill_id
            FROM "Skill"
            WHERE LOWER("nameEn") = LOWER(skill_name)
               OR LOWER("nameRu") = LOWER(skill_name)
               OR LOWER("nameHy") = LOWER(skill_name)
            LIMIT 1;
            
            -- If skill doesn't exist, create it
            IF skill_id IS NULL THEN
                INSERT INTO "Skill" ("nameEn", "nameRu", "nameHy", "createdAt", "updatedAt")
                VALUES (skill_name, skill_name, skill_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id INTO skill_id;
                
                skills_created := skills_created + 1;
            END IF;
            
            -- Create OrderSkill entry if it doesn't already exist
            INSERT INTO "OrderSkill" ("orderId", "skillId", "createdAt")
            VALUES (order_record.id, skill_id, CURRENT_TIMESTAMP)
            ON CONFLICT ("orderId", "skillId") DO NOTHING;
            
            IF FOUND THEN
                order_skills_created := order_skills_created + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE '  Skills processed: %', skills_processed;
    RAISE NOTICE '  Skills created: %', skills_created;
    RAISE NOTICE '  OrderSkill entries created: %', order_skills_created;
END $$;

COMMIT;

-- ============================================================
-- Verification Queries (Run these after migration)
-- ============================================================

-- Count total skills
-- SELECT COUNT(*) as total_skills FROM "Skill";

-- Count total OrderSkill entries
-- SELECT COUNT(*) as total_order_skills FROM "OrderSkill";

-- Count orders with skills (old way)
-- SELECT COUNT(*) as orders_with_old_skills 
-- FROM "Order" 
-- WHERE skills IS NOT NULL AND array_length(skills, 1) > 0;

-- Count orders with migrated skills
-- SELECT COUNT(DISTINCT "orderId") as orders_with_migrated_skills 
-- FROM "OrderSkill";

-- Sample of migrated skills
-- SELECT s."nameEn", COUNT(os."id") as usage_count
-- FROM "Skill" s
-- LEFT JOIN "OrderSkill" os ON s."id" = os."skillId"
-- GROUP BY s."id", s."nameEn"
-- ORDER BY usage_count DESC
-- LIMIT 10;

-- ============================================================
-- Step 7: Remove skills column from Order table
-- ============================================================
-- IMPORTANT: Only run this AFTER verifying the migration
-- Uncomment the line below when you're ready to remove the old column:

-- BEGIN;
-- ALTER TABLE "Order" DROP COLUMN IF EXISTS "skills";
-- COMMIT;

