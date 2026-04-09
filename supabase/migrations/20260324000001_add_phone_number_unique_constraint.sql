-- This migration is a no-op: phone_number already has a UNIQUE constraint
-- from the initial schema (phone_number text not null unique).
-- The upsert uses onConflict: 'phone_number' accordingly.
SELECT 1;
