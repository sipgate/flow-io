-- Update voice providers to match sipgate AI Flow supported providers
-- sipgate AI Flow only supports Azure and ElevenLabs, not OpenAI or Google TTS

-- First, drop the old check constraint
alter table assistants
  drop constraint if exists assistants_voice_provider_check;

-- Then migrate existing assistants with openai or google to azure
update assistants
set
  voice_provider = 'azure',
  voice_id = case
    when voice_provider = 'openai' then 'en-US-JennyNeural'
    when voice_provider = 'google' then 'en-US-JennyNeural'
    else voice_id
  end
where voice_provider in ('openai', 'google');

-- Add new check constraint with only azure and elevenlabs
alter table assistants
  add constraint assistants_voice_provider_check
  check (voice_provider in ('azure', 'elevenlabs'));

-- Update comment
comment on column assistants.voice_provider is 'Voice TTS provider (azure, elevenlabs) - supported by sipgate AI Flow';
