/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "fcmToken" TEXT,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referralCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "referredBy" INTEGER;

-- CreateTable
CREATE TABLE "public"."OrderPricing" (
    "id" SERIAL NOT NULL,
    "minBudget" DOUBLE PRECISION NOT NULL,
    "maxBudget" DOUBLE PRECISION,
    "creditCost" DOUBLE PRECISION NOT NULL,
    "refundPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralReward" (
    "id" SERIAL NOT NULL,
    "referrerId" INTEGER NOT NULL,
    "referredUserId" INTEGER NOT NULL,
    "rewardAmount" DOUBLE PRECISION NOT NULL,
    "bonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderPricing_minBudget_idx" ON "public"."OrderPricing"("minBudget");

-- CreateIndex
CREATE INDEX "OrderPricing_maxBudget_idx" ON "public"."OrderPricing"("maxBudget");

-- CreateIndex
CREATE INDEX "OrderPricing_isActive_idx" ON "public"."OrderPricing"("isActive");

-- CreateIndex
CREATE INDEX "ReferralReward_referrerId_idx" ON "public"."ReferralReward"("referrerId");

-- CreateIndex
CREATE INDEX "ReferralReward_referredUserId_idx" ON "public"."ReferralReward"("referredUserId");

-- CreateIndex
CREATE INDEX "ReferralReward_status_idx" ON "public"."ReferralReward"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "public"."User"("referralCode");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralReward" ADD CONSTRAINT "ReferralReward_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralReward" ADD CONSTRAINT "ReferralReward_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
