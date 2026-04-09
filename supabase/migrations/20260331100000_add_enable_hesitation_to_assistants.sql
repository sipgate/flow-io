-- Add enable_hesitation flag to assistants
-- When true, the LLM uses the 'hesitate' tool to announce what it's about to do
-- before calling any KB or MCP tool. Works as a two-step conversation turn.
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS enable_hesitation BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN assistants.enable_hesitation IS
  'When true, the assistant announces what it is about to do before calling a tool (KB or MCP).';
