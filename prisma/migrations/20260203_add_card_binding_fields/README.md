# Migration: Add Card Binding Fields

This migration adds support for AmeriaBank card tokenization by adding `bindingId` and `cardHolderId` fields to the `card` table.

## Changes

- Adds `binding_id` column (TEXT, nullable, unique) to store AmeriaBank BindingID
- Adds `card_holder_id` column (TEXT, nullable) to store AmeriaBank CardHolderID
- Creates unique index on `binding_id` for fast lookups
- Creates regular index on `binding_id` for querying cards with bindings

## How to Apply

### Option 1: Using Prisma Migrate (Recommended)

```bash
cd backend
npx prisma migrate deploy
```

This will apply all pending migrations to your NeonDB database.

### Option 2: Manual SQL Execution

If you need to apply this migration manually, you can run the SQL directly in your NeonDB console:

```sql
-- AlterTable: Add bindingId and cardHolderId fields to card table for AmeriaBank card tokenization
ALTER TABLE "card" 
ADD COLUMN IF NOT EXISTS "binding_id" TEXT,
ADD COLUMN IF NOT EXISTS "card_holder_id" TEXT;

-- CreateIndex: Add unique index on binding_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS "card_binding_id_key" ON "card"("binding_id");

-- CreateIndex: Add index on binding_id for querying cards with bindings
CREATE INDEX IF NOT EXISTS "card_binding_id_idx" ON "card"("binding_id");
```

### Option 3: Using NeonDB Console

1. Log in to your NeonDB dashboard
2. Navigate to your database
3. Open the SQL Editor
4. Copy and paste the contents of `migration.sql`
5. Execute the SQL

## Verification

After applying the migration, verify the changes:

```sql
-- Check if columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'card' 
AND column_name IN ('binding_id', 'card_holder_id');

-- Check if indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'card' 
AND indexname LIKE '%binding%';
```

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Drop indexes
DROP INDEX IF EXISTS "card_binding_id_idx";
DROP INDEX IF EXISTS "card_binding_id_key";

-- Drop columns
ALTER TABLE "card" 
DROP COLUMN IF EXISTS "binding_id",
DROP COLUMN IF EXISTS "card_holder_id";
```

**Note:** Rolling back will remove all binding data. Make sure to backup your data first if needed.
