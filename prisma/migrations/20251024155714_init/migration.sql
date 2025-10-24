/*
  Warnings:

  - You are about to drop the column `features` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `technologies` on the `Service` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Service" DROP COLUMN "features",
DROP COLUMN "technologies";

-- CreateTable
CREATE TABLE "Feature" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameRu" TEXT,
    "nameHy" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "descriptionRu" TEXT,
    "descriptionHy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technology" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameRu" TEXT,
    "nameHy" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "descriptionRu" TEXT,
    "descriptionHy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceFeature" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "featureId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTechnology" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "technologyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceTechnology_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feature_isActive_idx" ON "Feature"("isActive");

-- CreateIndex
CREATE INDEX "Technology_isActive_idx" ON "Technology"("isActive");

-- CreateIndex
CREATE INDEX "ServiceFeature_serviceId_idx" ON "ServiceFeature"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceFeature_featureId_idx" ON "ServiceFeature"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceFeature_serviceId_featureId_key" ON "ServiceFeature"("serviceId", "featureId");

-- CreateIndex
CREATE INDEX "ServiceTechnology_serviceId_idx" ON "ServiceTechnology"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceTechnology_technologyId_idx" ON "ServiceTechnology"("technologyId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTechnology_serviceId_technologyId_key" ON "ServiceTechnology"("serviceId", "technologyId");

-- AddForeignKey
ALTER TABLE "ServiceFeature" ADD CONSTRAINT "ServiceFeature_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceFeature" ADD CONSTRAINT "ServiceFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTechnology" ADD CONSTRAINT "ServiceTechnology_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTechnology" ADD CONSTRAINT "ServiceTechnology_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "Technology"("id") ON DELETE CASCADE ON UPDATE CASCADE;
