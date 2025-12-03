-- Convert any existing "approved" orders to "open" status
-- This ensures consistency since approved orders should be "open" for specialists to apply
UPDATE "Order" SET status = 'open' WHERE status = 'approved';

