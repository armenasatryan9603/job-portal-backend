-- Migration: Add Peer Application System
-- This migration adds support for specialists to apply to orders with peers (group applications)
-- 
-- Changes:
-- 1. Adds isGroupApplication and leadUserId fields to OrderProposal
-- 2. Creates PeerRelationship table for managing peer connections
-- 3. Creates Team and TeamMember tables for team management
-- 4. Creates ProposalPeer table to track peers in group applications
-- 5. Creates SystemConfig table for system-wide configuration
-- 6. Adds indexes and foreign key constraints
-- 7. Inserts default maxPeersPerApplication configuration
-- 8. Backfills existing OrderProposal records

-- AlterTable: Add peer application fields to OrderProposal
ALTER TABLE "public"."OrderProposal" 
ADD COLUMN "isGroupApplication" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "leadUserId" INTEGER;

-- CreateTable: PeerRelationship
CREATE TABLE "public"."PeerRelationship" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "peerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PeerRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Team
CREATE TABLE "public"."Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamMember
CREATE TABLE "public"."TeamMember" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProposalPeer
CREATE TABLE "public"."ProposalPeer" (
    "id" SERIAL NOT NULL,
    "proposalId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalPeer_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SystemConfig
CREATE TABLE "public"."SystemConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: PeerRelationship indexes
CREATE INDEX "PeerRelationship_userId_idx" ON "public"."PeerRelationship"("userId");
CREATE INDEX "PeerRelationship_peerId_idx" ON "public"."PeerRelationship"("peerId");
CREATE INDEX "PeerRelationship_isActive_idx" ON "public"."PeerRelationship"("isActive");

-- CreateIndex: Team indexes
CREATE INDEX "Team_createdBy_idx" ON "public"."Team"("createdBy");
CREATE INDEX "Team_isActive_idx" ON "public"."Team"("isActive");

-- CreateIndex: TeamMember indexes
CREATE INDEX "TeamMember_teamId_idx" ON "public"."TeamMember"("teamId");
CREATE INDEX "TeamMember_userId_idx" ON "public"."TeamMember"("userId");
CREATE INDEX "TeamMember_isActive_idx" ON "public"."TeamMember"("isActive");

-- CreateIndex: ProposalPeer indexes
CREATE INDEX "ProposalPeer_proposalId_idx" ON "public"."ProposalPeer"("proposalId");
CREATE INDEX "ProposalPeer_userId_idx" ON "public"."ProposalPeer"("userId");
CREATE INDEX "ProposalPeer_status_idx" ON "public"."ProposalPeer"("status");

-- CreateIndex: SystemConfig index
CREATE INDEX "SystemConfig_key_idx" ON "public"."SystemConfig"("key");

-- CreateUniqueConstraint: PeerRelationship unique constraint
CREATE UNIQUE INDEX "PeerRelationship_userId_peerId_key" ON "public"."PeerRelationship"("userId", "peerId");

-- CreateUniqueConstraint: TeamMember unique constraint
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "public"."TeamMember"("teamId", "userId");

-- CreateUniqueConstraint: ProposalPeer unique constraint
CREATE UNIQUE INDEX "ProposalPeer_proposalId_userId_key" ON "public"."ProposalPeer"("proposalId", "userId");

-- CreateUniqueConstraint: SystemConfig unique constraint
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "public"."SystemConfig"("key");

-- AddForeignKey: OrderProposal.leadUserId -> User.id
ALTER TABLE "public"."OrderProposal" 
ADD CONSTRAINT "OrderProposal_leadUserId_fkey" 
FOREIGN KEY ("leadUserId") REFERENCES "public"."User"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PeerRelationship.userId -> User.id
ALTER TABLE "public"."PeerRelationship" 
ADD CONSTRAINT "PeerRelationship_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PeerRelationship.peerId -> User.id
ALTER TABLE "public"."PeerRelationship" 
ADD CONSTRAINT "PeerRelationship_peerId_fkey" 
FOREIGN KEY ("peerId") REFERENCES "public"."User"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Team.createdBy -> User.id
ALTER TABLE "public"."Team" 
ADD CONSTRAINT "Team_createdBy_fkey" 
FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: TeamMember.teamId -> Team.id
ALTER TABLE "public"."TeamMember" 
ADD CONSTRAINT "TeamMember_teamId_fkey" 
FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TeamMember.userId -> User.id
ALTER TABLE "public"."TeamMember" 
ADD CONSTRAINT "TeamMember_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProposalPeer.proposalId -> OrderProposal.id
ALTER TABLE "public"."ProposalPeer" 
ADD CONSTRAINT "ProposalPeer_proposalId_fkey" 
FOREIGN KEY ("proposalId") REFERENCES "public"."OrderProposal"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProposalPeer.userId -> User.id
ALTER TABLE "public"."ProposalPeer" 
ADD CONSTRAINT "ProposalPeer_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default system configuration for max peers per application
INSERT INTO "public"."SystemConfig" ("key", "value", "description", "createdAt", "updatedAt")
VALUES (
    'maxPeersPerApplication',
    '5',
    'Maximum number of peers that can be included in a group application',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

-- Backfill existing OrderProposal records
-- Set isGroupApplication to false and leadUserId to userId for existing proposals
-- This ensures all existing proposals are marked as single applications
UPDATE "public"."OrderProposal"
SET 
    "isGroupApplication" = false,
    "leadUserId" = "userId"
WHERE "leadUserId" IS NULL;

