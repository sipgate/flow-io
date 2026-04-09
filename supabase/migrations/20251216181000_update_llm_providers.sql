-- Update LLM provider constraint to use 'google' instead of 'gemini'
-- This matches the actual provider implementation

-- First, drop the old check constraint
alter table assistants
  drop constraint if exists assistants_llm_provider_check;

-- Update existing 'gemini' values to 'google' if any exist
update assistants
set llm_provider = 'google'
where llm_provider = 'gemini';

-- Add new check constraint with 'google'
alter table assistants
  add constraint assistants_llm_provider_check
  check (llm_provider in ('openai', 'google'));

-- Update comment
comment on column assistants.llm_provider is 'LLM provider (openai, google)';
