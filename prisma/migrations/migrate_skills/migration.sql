-- Migration: Convert skills from string array to Skill and OrderSkill tables
-- This migration creates the Skill and OrderSkill tables and migrates existing data

-- Step 1: Create Skill table
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

-- Step 2: Create indexes on Skill table for search performance
CREATE INDEX IF NOT EXISTS "Skill_nameEn_idx" ON "Skill"("nameEn");
CREATE INDEX IF NOT EXISTS "Skill_nameRu_idx" ON "Skill"("nameRu");
CREATE INDEX IF NOT EXISTS "Skill_nameHy_idx" ON "Skill"("nameHy");

-- Step 3: Create OrderSkill junction table
CREATE TABLE IF NOT EXISTS "OrderSkill" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderSkill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderSkill_orderId_skillId_key" UNIQUE ("orderId", "skillId")
);

-- Step 4: Create indexes on OrderSkill table
CREATE INDEX IF NOT EXISTS "OrderSkill_orderId_idx" ON "OrderSkill"("orderId");
CREATE INDEX IF NOT EXISTS "OrderSkill_skillId_idx" ON "OrderSkill"("skillId");

-- Step 5: Add foreign key constraints
ALTER TABLE "OrderSkill" ADD CONSTRAINT "OrderSkill_orderId_fkey" 
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderSkill" ADD CONSTRAINT "OrderSkill_skillId_fkey" 
    FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Migrate existing skills data
-- This will extract unique skills from Order.skills array and create Skill entries
-- Then create OrderSkill entries linking orders to skills

DO $$
DECLARE
    order_record RECORD;
    skill_name TEXT;
    skill_id INTEGER;
    skill_array TEXT[];
    skill_item TEXT;
BEGIN
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
            IF skill_name = '' THEN
                CONTINUE;
            END IF;
            
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
            END IF;
            
            -- Create OrderSkill entry if it doesn't already exist
            INSERT INTO "OrderSkill" ("orderId", "skillId", "createdAt")
            VALUES (order_record.id, skill_id, CURRENT_TIMESTAMP)
            ON CONFLICT ("orderId", "skillId") DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Step 7: Remove the skills column from Order table
-- Note: This is commented out by default. Uncomment after verifying data migration.
-- ALTER TABLE "Order" DROP COLUMN IF EXISTS "skills";

-- Step 8: Verify migration
-- Run these queries to verify the migration:
-- SELECT COUNT(*) FROM "Skill";
-- SELECT COUNT(*) FROM "OrderSkill";
-- SELECT COUNT(*) FROM "Order" WHERE skills IS NOT NULL AND array_length(skills, 1) > 0;

