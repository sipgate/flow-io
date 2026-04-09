-- Store the default transfer instruction on the assistant so it can be reused across flows
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS transfer_instruction text;
