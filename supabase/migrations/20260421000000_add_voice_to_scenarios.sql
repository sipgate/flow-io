-- Add scenario-level voice configuration
-- Used for DTMF node announcements and as base voice for agents with inherit_voice

ALTER TABLE call_scenarios
  ADD COLUMN IF NOT EXISTS voice_provider TEXT,
  ADD COLUMN IF NOT EXISTS voice_id       TEXT,
  ADD COLUMN IF NOT EXISTS voice_language TEXT;
