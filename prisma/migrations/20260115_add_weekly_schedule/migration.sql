-- AlterTable: Add weeklySchedule field to Order table for recurring weekly patterns
ALTER TABLE "Order" ADD COLUMN "weeklySchedule" JSONB;

-- Comment: Document the purpose of the new column
COMMENT ON COLUMN "Order"."weeklySchedule" IS 'Recurring weekly schedule for permanent orders. Stores day-by-day availability with work hours and time slots in JSON format.';
