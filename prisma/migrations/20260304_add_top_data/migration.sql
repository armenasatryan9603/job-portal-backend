-- CreateTable
CREATE TABLE "TopData" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "country" TEXT,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopData_sortOrder_idx" ON "TopData"("sortOrder");
