-- Add 'immediate' to the barge_in_strategy CHECK constraint
-- The immediate strategy uses Voice Activity Detection (VAD) for fastest barge-in (20-100ms)

ALTER TABLE call_tool_configs
  DROP CONSTRAINT IF EXISTS call_tool_configs_barge_in_strategy_check;

ALTER TABLE call_tool_configs
  ADD CONSTRAINT call_tool_configs_barge_in_strategy_check
    CHECK (barge_in_strategy IN ('none', 'manual', 'minimum_characters', 'immediate'));
