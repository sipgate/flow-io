-- Add block_id to phone_numbers to group numbers that belong to the same block
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS block_id uuid;

CREATE INDEX IF NOT EXISTS idx_phone_numbers_block_id ON phone_numbers(block_id);
