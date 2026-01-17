-- AlterTable: Add new fields to Order table for permanent orders
ALTER TABLE "Order" ADD COLUMN "orderType" TEXT NOT NULL DEFAULT 'one_time';
ALTER TABLE "Order" ADD COLUMN "workDurationPerClient" INTEGER;

-- CreateIndex: Add index on orderType for faster filtering
CREATE INDEX "Order_orderType_idx" ON "Order"("orderType");

-- CreateTable: Booking table for permanent order check-ins
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Indexes for Booking table
CREATE INDEX "Booking_orderId_idx" ON "Booking"("orderId");
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");
CREATE INDEX "Booking_scheduledDate_idx" ON "Booking"("scheduledDate");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- AddForeignKey: Link Booking to Order
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link Booking to User (Client)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
