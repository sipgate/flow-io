-- Fix phone_numbers_assistant_id_fkey: ensure ON DELETE SET NULL is in effect.
-- Drops and recreates the constraint to guarantee correct behavior regardless
-- of how the live DB ended up (manual changes, prior migration drift, etc.).

ALTER TABLE phone_numbers
  DROP CONSTRAINT IF EXISTS phone_numbers_assistant_id_fkey;

ALTER TABLE phone_numbers
  ADD CONSTRAINT phone_numbers_assistant_id_fkey
    FOREIGN KEY (assistant_id)
    REFERENCES assistants(id)
    ON DELETE SET NULL;
