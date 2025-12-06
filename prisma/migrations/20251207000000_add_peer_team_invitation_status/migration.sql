-- AlterTable - Add status column first for PeerRelationship
ALTER TABLE "PeerRelationship" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "PeerRelationship" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Set default values for existing rows in PeerRelationship
UPDATE "PeerRelationship" SET "status" = 'accepted' WHERE "status" IS NULL;
UPDATE "PeerRelationship" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;

-- Now make them NOT NULL with defaults for PeerRelationship
ALTER TABLE "PeerRelationship" ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "PeerRelationship" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "PeerRelationship" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PeerRelationship" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable - Add status column first for TeamMember
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Set default values for existing rows in TeamMember
UPDATE "TeamMember" SET "status" = 'accepted' WHERE "status" IS NULL;
UPDATE "TeamMember" SET "updatedAt" = COALESCE("joinedAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;

-- Now make them NOT NULL with defaults for TeamMember
ALTER TABLE "TeamMember" ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "TeamMember" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "TeamMember" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TeamMember" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PeerRelationship_status_idx" ON "PeerRelationship"("status");

-- CreateIndex
CREATE INDEX "TeamMember_status_idx" ON "TeamMember"("status");

-- Update existing records to accepted status (backward compatibility) - already done above

