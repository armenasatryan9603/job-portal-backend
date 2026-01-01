-- AlterTable: Add bannerUrl and description fields to Team
ALTER TABLE "public"."Team" 
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT;
