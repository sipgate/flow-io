-- Replace barge_in_enabled boolean with barge_in_strategy text
-- to support all three sipgate AI Flow strategies: none, manual, minimum_characters

ALTER TABLE call_tool_configs
  ADD COLUMN barge_in_strategy TEXT DEFAULT 'minimum_characters'
    CHECK (barge_in_strategy IN ('none', 'manual', 'minimum_characters', 'immediate'));

-- Migrate existing data: enabled=true → minimum_characters, enabled=false → none
UPDATE call_tool_configs
  SET barge_in_strategy = CASE
    WHEN barge_in_enabled = true THEN 'minimum_characters'
    ELSE 'none'
  END;

-- Drop the old boolean column
ALTER TABLE call_tool_configs DROP COLUMN barge_in_enabled;
