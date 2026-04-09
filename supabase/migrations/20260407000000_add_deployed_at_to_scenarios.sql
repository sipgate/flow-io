-- Add deployed_at column to call_scenarios to track when the scenario was last deployed
ALTER TABLE call_scenarios ADD COLUMN deployed_at timestamptz;

-- Backfill deployed_at for scenarios that already have published versions
UPDATE call_scenarios s
SET deployed_at = (
  SELECT MAX(published_at)
  FROM call_scenario_versions v
  WHERE v.scenario_id = s.id
);
