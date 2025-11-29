-- CreateTable
CREATE TABLE "OrderQuestion" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderQuestion_orderId_idx" ON "OrderQuestion"("orderId");

-- AddForeignKey
ALTER TABLE "OrderQuestion" ADD CONSTRAINT "OrderQuestion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
