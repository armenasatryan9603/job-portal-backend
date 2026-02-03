-- AlterTable: Add bindingId and cardHolderId fields to card table for AmeriaBank card tokenization
ALTER TABLE "card" 
ADD COLUMN IF NOT EXISTS "binding_id" TEXT,
ADD COLUMN IF NOT EXISTS "card_holder_id" TEXT;

-- CreateIndex: Add unique index on binding_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS "card_binding_id_key" ON "card"("binding_id");

-- CreateIndex: Add index on binding_id for querying cards with bindings
CREATE INDEX IF NOT EXISTS "card_binding_id_idx" ON "card"("binding_id");
