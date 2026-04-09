-- Add individual voice and LLM fields to assistants table
-- We'll keep voice_config for backwards compatibility but add explicit fields for better querying

alter table assistants
  add column voice_provider text check (voice_provider in ('openai', 'google', 'elevenlabs')),
  add column voice_id text,
  add column voice_language text,
  add column llm_temperature float,
  add column opening_message text;

-- Rename temperature to llm_temperature for clarity (keep both for now)
-- Update default value
alter table assistants
  alter column temperature set default 0.7;

-- Update comments
comment on column assistants.voice_provider is 'Voice TTS provider (openai, google, elevenlabs)';
comment on column assistants.voice_id is 'Voice ID/name from the provider';
comment on column assistants.voice_language is 'Voice language code (e.g., en-US)';
comment on column assistants.llm_temperature is 'LLM temperature setting (0-2)';
comment on column assistants.opening_message is 'First message when call is answered';
