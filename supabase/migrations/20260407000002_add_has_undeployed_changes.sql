-- Replace fragile timestamp comparison (updated_at vs deployed_at) with explicit boolean flag.
-- The updated_at trigger always sets updated_at to DB server time, which is slightly after
-- the JS timestamp used for deployed_at, causing false positives.
ALTER TABLE assistants ADD COLUMN has_undeployed_changes BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark assistants that were saved after their last deploy as having undeployed changes
UPDATE assistants
SET has_undeployed_changes = true
WHERE deployed_at IS NOT NULL
  AND updated_at > deployed_at + interval '3 seconds';

UPDATE assistants
SET has_undeployed_changes = true
WHERE deployed_at IS NULL
  AND (nodes IS NOT NULL OR system_prompt IS NOT NULL);
