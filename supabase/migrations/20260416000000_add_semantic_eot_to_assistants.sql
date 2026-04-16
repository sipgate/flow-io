-- Add semantic end-of-turn detection to assistants
-- When enabled, the LLM checks whether the user has finished their sentence
-- before generating a response. Incomplete utterances are held in state until
-- the user continues speaking.

ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS enable_semantic_eot BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN assistants.enable_semantic_eot IS
  'When true, the assistant waits for the user to finish their sentence before responding. '
  'The LLM detects incomplete utterances via a wait_for_turn tool call and silently accumulates '
  'speech until a complete thought is received.';
