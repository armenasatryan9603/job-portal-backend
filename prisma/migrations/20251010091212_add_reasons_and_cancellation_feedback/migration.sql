/*
  Warnings:

  - Added the required column `updatedAt` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Review" ADD COLUMN     "feedbackType" TEXT NOT NULL DEFAULT 'completed',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."Reason" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameHy" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionRu" TEXT,
    "descriptionHy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewReason" (
    "id" SERIAL NOT NULL,
    "reviewId" INTEGER NOT NULL,
    "reasonId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reason_code_key" ON "public"."Reason"("code");

-- CreateIndex
CREATE INDEX "Reason_code_idx" ON "public"."Reason"("code");

-- CreateIndex
CREATE INDEX "Reason_isActive_idx" ON "public"."Reason"("isActive");

-- CreateIndex
CREATE INDEX "ReviewReason_reviewId_idx" ON "public"."ReviewReason"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewReason_reasonId_idx" ON "public"."ReviewReason"("reasonId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReason_reviewId_reasonId_key" ON "public"."ReviewReason"("reviewId", "reasonId");

-- CreateIndex
CREATE INDEX "Review_feedbackType_idx" ON "public"."Review"("feedbackType");

-- AddForeignKey
ALTER TABLE "public"."ReviewReason" ADD CONSTRAINT "ReviewReason_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewReason" ADD CONSTRAINT "ReviewReason_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "public"."Reason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
