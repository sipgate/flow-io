-- Add 'mistral' to the LLM provider check constraint
alter table assistants
  drop constraint if exists assistants_llm_provider_check;

alter table assistants
  add constraint assistants_llm_provider_check
  check (llm_provider in ('openai', 'google', 'mistral'));

comment on column assistants.llm_provider is 'LLM provider (openai, google, mistral)';
