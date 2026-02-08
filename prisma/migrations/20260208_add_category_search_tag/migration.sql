-- AlterTable
ALTER TABLE "Category" ADD COLUMN "searchTag" TEXT;

-- CreateIndex
CREATE INDEX "Category_searchTag_idx" ON "Category"("searchTag");
