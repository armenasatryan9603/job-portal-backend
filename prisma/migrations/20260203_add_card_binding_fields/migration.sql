-- AlterTable: Add bindingId and cardHolderId fields to Card table for AmeriaBank card tokenization
ALTER TABLE "Card" 
ADD COLUMN IF NOT EXISTS "binding_id" TEXT,
ADD COLUMN IF NOT EXISTS "card_holder_id" TEXT;

-- CreateIndex: Add unique index on binding_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS "card_binding_id_key" ON "Card"("binding_id");

-- CreateIndex: Add index on binding_id for querying cards with bindings
CREATE INDEX IF NOT EXISTS "card_binding_id_idx" ON "Card"("binding_id");
