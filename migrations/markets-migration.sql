-- ============================================
-- MARKETS FEATURE MIGRATION
-- ============================================
-- Description: Adds Markets feature with members, roles, reviews, orders, media, and subscriptions
-- Date: 2026-01-XX
-- Author: Job Portal Team
--
-- This migration adds:
-- 1. Market model
-- 2. MarketMember model
-- 3. MarketRole model
-- 4. MarketReview model
-- 5. MarketOrder junction table
-- 6. MarketMediaFile model
-- 7. MarketSubscription model
-- 8. Updates to existing models (User, Order, SubscriptionPlan, MediaFile)
--
-- IMPORTANT: Backup your database before running this migration!
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Create Market table
-- ============================================
CREATE TABLE IF NOT EXISTS "Market" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameRu" TEXT,
    "nameHy" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "descriptionRu" TEXT,
    "descriptionHy" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "bannerImageId" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectionReason" TEXT,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 2: Create MarketMember table
-- ============================================
CREATE TABLE IF NOT EXISTS "MarketMember" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarketMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarketMember_marketId_userId_key" UNIQUE ("marketId", "userId")
);

-- ============================================
-- STEP 3: Create MarketRole table
-- ============================================
CREATE TABLE IF NOT EXISTS "MarketRole" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameRu" TEXT,
    "nameHy" TEXT,
    "permissions" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketRole_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 4: Create MarketReview table
-- ============================================
CREATE TABLE IF NOT EXISTS "MarketReview" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketReview_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 5: Create MarketOrder junction table
-- ============================================
CREATE TABLE IF NOT EXISTS "MarketOrder" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarketOrder_marketId_orderId_key" UNIQUE ("marketId", "orderId")
);

-- ============================================
-- STEP 6: Create MarketMediaFile table
-- ============================================
CREATE TABLE IF NOT EXISTS "MarketMediaFile" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketMediaFile_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 7: Create MarketSubscription table
-- ============================================
CREATE TABLE IF NOT EXISTS "MarketSubscription" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "subscriptionPlanId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSubscription_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 8: Add foreign key constraints
-- ============================================
ALTER TABLE "Market" ADD CONSTRAINT "Market_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Market" ADD CONSTRAINT "Market_bannerImageId_fkey" FOREIGN KEY ("bannerImageId") REFERENCES "MarketMediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketMember" ADD CONSTRAINT "MarketMember_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketMember" ADD CONSTRAINT "MarketMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketRole" ADD CONSTRAINT "MarketRole_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketReview" ADD CONSTRAINT "MarketReview_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketReview" ADD CONSTRAINT "MarketReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketMediaFile" ADD CONSTRAINT "MarketMediaFile_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketMediaFile" ADD CONSTRAINT "MarketMediaFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketSubscription" ADD CONSTRAINT "MarketSubscription_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketSubscription" ADD CONSTRAINT "MarketSubscription_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketSubscription" ADD CONSTRAINT "MarketSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- STEP 9: Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS "Market_status_idx" ON "Market"("status");
CREATE INDEX IF NOT EXISTS "Market_createdBy_idx" ON "Market"("createdBy");
CREATE INDEX IF NOT EXISTS "Market_verified_idx" ON "Market"("verified");
CREATE INDEX IF NOT EXISTS "Market_location_idx" ON "Market"("location");

CREATE INDEX IF NOT EXISTS "MarketMember_marketId_idx" ON "MarketMember"("marketId");
CREATE INDEX IF NOT EXISTS "MarketMember_userId_idx" ON "MarketMember"("userId");
CREATE INDEX IF NOT EXISTS "MarketMember_status_idx" ON "MarketMember"("status");
CREATE INDEX IF NOT EXISTS "MarketMember_isActive_idx" ON "MarketMember"("isActive");

CREATE INDEX IF NOT EXISTS "MarketRole_marketId_idx" ON "MarketRole"("marketId");
CREATE INDEX IF NOT EXISTS "MarketRole_isDefault_idx" ON "MarketRole"("isDefault");

CREATE INDEX IF NOT EXISTS "MarketReview_marketId_idx" ON "MarketReview"("marketId");
CREATE INDEX IF NOT EXISTS "MarketReview_reviewerId_idx" ON "MarketReview"("reviewerId");
CREATE INDEX IF NOT EXISTS "MarketReview_rating_idx" ON "MarketReview"("rating");

CREATE INDEX IF NOT EXISTS "MarketOrder_marketId_idx" ON "MarketOrder"("marketId");
CREATE INDEX IF NOT EXISTS "MarketOrder_orderId_idx" ON "MarketOrder"("orderId");

CREATE INDEX IF NOT EXISTS "MarketMediaFile_marketId_idx" ON "MarketMediaFile"("marketId");
CREATE INDEX IF NOT EXISTS "MarketMediaFile_uploadedBy_idx" ON "MarketMediaFile"("uploadedBy");
CREATE INDEX IF NOT EXISTS "MarketMediaFile_createdAt_idx" ON "MarketMediaFile"("createdAt");

CREATE INDEX IF NOT EXISTS "MarketSubscription_marketId_idx" ON "MarketSubscription"("marketId");
CREATE INDEX IF NOT EXISTS "MarketSubscription_userId_idx" ON "MarketSubscription"("userId");
CREATE INDEX IF NOT EXISTS "MarketSubscription_status_idx" ON "MarketSubscription"("status");
CREATE INDEX IF NOT EXISTS "MarketSubscription_endDate_idx" ON "MarketSubscription"("endDate");
CREATE INDEX IF NOT EXISTS "MarketSubscription_marketId_status_idx" ON "MarketSubscription"("marketId", "status");

COMMIT;

-- ============================================
-- Migration completed successfully!
-- ============================================
-- Next steps:
-- 1. Run: npx prisma generate (to update Prisma Client)
-- 2. Test the new Markets feature
-- ============================================
