-- CreateTable
CREATE TABLE "OrderChangeHistory" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderChangeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderChangeHistory_orderId_idx" ON "OrderChangeHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderChangeHistory_createdAt_idx" ON "OrderChangeHistory"("createdAt");

-- CreateIndex
CREATE INDEX "OrderChangeHistory_fieldChanged_idx" ON "OrderChangeHistory"("fieldChanged");

-- AddForeignKey
ALTER TABLE "OrderChangeHistory" ADD CONSTRAINT "OrderChangeHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChangeHistory" ADD CONSTRAINT "OrderChangeHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

