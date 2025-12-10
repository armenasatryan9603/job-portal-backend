-- AlterTable
ALTER TABLE "Order" ADD COLUMN "currency" TEXT DEFAULT 'AMD';
ALTER TABLE "Order" ADD COLUMN "rateUnit" TEXT DEFAULT 'per_project';

