-- CreateTable
CREATE TABLE "SavedOrder" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedOrder_userId_orderId_key" ON "SavedOrder"("userId", "orderId");

-- CreateIndex
CREATE INDEX "SavedOrder_userId_idx" ON "SavedOrder"("userId");

-- CreateIndex
CREATE INDEX "SavedOrder_orderId_idx" ON "SavedOrder"("orderId");

-- CreateIndex
CREATE INDEX "SavedOrder_createdAt_idx" ON "SavedOrder"("createdAt");

-- AddForeignKey
ALTER TABLE "SavedOrder" ADD CONSTRAINT "SavedOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOrder" ADD CONSTRAINT "SavedOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

