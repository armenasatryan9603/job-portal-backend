-- CreateTable: TeamPortfolio
CREATE TABLE "TeamPortfolio" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamPortfolio_teamId_idx" ON "TeamPortfolio"("teamId");

-- CreateIndex
CREATE INDEX "TeamPortfolio_createdAt_idx" ON "TeamPortfolio"("createdAt");

-- AddForeignKey
ALTER TABLE "TeamPortfolio" ADD CONSTRAINT "TeamPortfolio_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
