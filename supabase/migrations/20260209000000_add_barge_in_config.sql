-- Add barge-in configuration to call_tool_configs
-- barge_in_enabled = true → strategy "minimum_characters" (with thresholds)
-- barge_in_enabled = false → strategy "none"

ALTER TABLE call_tool_configs
  ADD COLUMN barge_in_enabled BOOLEAN DEFAULT true,
  ADD COLUMN barge_in_minimum_characters INTEGER DEFAULT 3,
  ADD COLUMN barge_in_allow_after_ms INTEGER DEFAULT 0;
