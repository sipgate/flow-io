-- Make deploy/apply-to-calls a real activation boundary for draft-backed fields.

-- Scenario draft state should be explicit, matching assistants.
ALTER TABLE call_scenarios
  ADD COLUMN IF NOT EXISTS has_undeployed_changes BOOLEAN NOT NULL DEFAULT false;

UPDATE call_scenarios
SET has_undeployed_changes = true
WHERE deployed_at IS NULL
  AND (jsonb_array_length(nodes) > 0 OR jsonb_array_length(edges) > 0);

UPDATE call_scenarios
SET has_undeployed_changes = true
WHERE deployed_at IS NOT NULL
  AND updated_at > deployed_at + interval '3 seconds';

-- Scenario voice affects live DTMF announcements and inherit-voice agents,
-- so it needs to be captured in deployed scenario snapshots.
ALTER TABLE call_scenario_versions
  ADD COLUMN IF NOT EXISTS voice_provider TEXT,
  ADD COLUMN IF NOT EXISTS voice_id TEXT,
  ADD COLUMN IF NOT EXISTS voice_language TEXT;

WITH latest_versions AS (
  SELECT DISTINCT ON (scenario_id)
    id,
    scenario_id
  FROM call_scenario_versions
  ORDER BY scenario_id, version DESC, published_at DESC NULLS LAST, created_at DESC NULLS LAST
)
UPDATE call_scenario_versions v
SET
  voice_provider = s.voice_provider,
  voice_id = s.voice_id,
  voice_language = s.voice_language
FROM latest_versions lv
JOIN call_scenarios s ON s.id = lv.scenario_id
WHERE v.id = lv.id
  AND v.voice_provider IS NULL
  AND v.voice_id IS NULL
  AND v.voice_language IS NULL;

-- Semantic EOT is a behavior setting, so deployed assistant snapshots must include it.
ALTER TABLE assistant_versions
  ADD COLUMN IF NOT EXISTS enable_semantic_eot BOOLEAN;

WITH latest_versions AS (
  SELECT DISTINCT ON (assistant_id)
    id,
    assistant_id
  FROM assistant_versions
  ORDER BY assistant_id, version DESC, deployed_at DESC NULLS LAST, created_at DESC NULLS LAST
)
UPDATE assistant_versions v
SET enable_semantic_eot = a.enable_semantic_eot
FROM latest_versions lv
JOIN assistants a ON a.id = lv.assistant_id
WHERE v.id = lv.id
  AND v.enable_semantic_eot IS NULL;
