-- Fix call_sessions_assistant_id_fkey: ensure ON DELETE SET NULL is in effect.
-- Drops and recreates the constraint to guarantee correct behavior regardless
-- of how the live DB ended up (manual changes, prior migration drift, etc.).
-- Also makes assistant_id nullable so SET NULL can work.

ALTER TABLE call_sessions
  DROP CONSTRAINT IF EXISTS call_sessions_assistant_id_fkey;

ALTER TABLE call_sessions
  ALTER COLUMN assistant_id DROP NOT NULL;

ALTER TABLE call_sessions
  ADD CONSTRAINT call_sessions_assistant_id_fkey
    FOREIGN KEY (assistant_id)
    REFERENCES assistants(id)
    ON DELETE SET NULL;
