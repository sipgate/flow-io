-- Add lightweight context for applied assistant and scenario versions.

ALTER TABLE call_scenario_versions
  ADD COLUMN IF NOT EXISTS change_summary TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS restored_from_version INTEGER;

ALTER TABLE assistant_versions
  ADD COLUMN IF NOT EXISTS change_summary TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS restored_from_version INTEGER;

UPDATE call_scenario_versions
SET change_summary = ARRAY['initial']::TEXT[]
WHERE version = 1
  AND cardinality(change_summary) = 0;

UPDATE assistant_versions
SET change_summary = ARRAY['initial']::TEXT[]
WHERE version = 1
  AND cardinality(change_summary) = 0;
