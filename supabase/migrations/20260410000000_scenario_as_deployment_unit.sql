-- Migration: Make scenarios the mandatory deployment unit
--
-- Changes:
-- 1. Add enable_csat to call_scenarios (move from assistants)
-- 2. Add scenario_id to call_criteria
-- 3. Auto-create scenarios for direct-routed phone numbers
-- 4. Remove assistant_id from phone_numbers, make scenario_id NOT NULL
-- 5. Prepare test_suites/test_runs for scenario support (Phase 2)
-- 6. Clean up assistant trigger for phone_numbers


-- ── 1. CSAT: Add enable_csat to call_scenarios ──────────────────────────────

ALTER TABLE call_scenarios
  ADD COLUMN IF NOT EXISTS enable_csat BOOLEAN DEFAULT false;


-- ── 2. Migrate CSAT settings from assistants to scenarios ───────────────────
-- For each scenario node that references an assistant with enable_csat=true,
-- enable CSAT on the scenario. Safe to re-run (idempotent UPDATE).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistants' AND column_name = 'enable_csat'
  ) THEN
    EXECUTE '
      UPDATE call_scenarios cs
      SET enable_csat = true
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(cs.nodes) AS node
        JOIN assistants a ON (node->''data''->>''assistant_id'')::uuid = a.id
        WHERE a.enable_csat = true
      )';
  END IF;
END $$;


-- ── 3. Call Criteria: Add scenario_id column ────────────────────────────────

ALTER TABLE call_criteria
  ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES call_scenarios(id) ON DELETE CASCADE;

-- A criterion belongs to AT MOST one scope: assistant OR scenario (not both)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'call_criteria_scope_check'
  ) THEN
    ALTER TABLE call_criteria
      ADD CONSTRAINT call_criteria_scope_check
      CHECK (NOT (assistant_id IS NOT NULL AND scenario_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_criteria_scenario ON call_criteria(scenario_id);


-- ── 4. Auto-create scenarios for direct-routed phone numbers ────────────────
-- For each phone_number that has assistant_id set but no scenario_id,
-- create a single-node scenario and assign it.
-- Only runs if assistant_id column still exists on phone_numbers.

DO $$
DECLARE
  rec RECORD;
  new_scenario_id UUID;
  node_id TEXT;
  a_name TEXT;
  a_csat BOOLEAN;
BEGIN
  -- Skip if assistant_id column was already dropped (re-run safety)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phone_numbers' AND column_name = 'assistant_id'
  ) THEN
    RAISE NOTICE 'assistant_id already dropped from phone_numbers, skipping auto-create';
    RETURN;
  END IF;

  FOR rec IN
    SELECT p.id AS phone_id, p.assistant_id, p.organization_id, p.phone_number
    FROM phone_numbers p
    WHERE p.assistant_id IS NOT NULL
      AND p.scenario_id IS NULL
  LOOP
    -- Get assistant info
    SELECT a.name, COALESCE(a.enable_csat, false)
    INTO a_name, a_csat
    FROM assistants a
    WHERE a.id = rec.assistant_id;

    -- Generate IDs
    new_scenario_id := gen_random_uuid();
    node_id := gen_random_uuid();

    -- Create scenario with single entry_agent node
    INSERT INTO call_scenarios (id, organization_id, name, description, nodes, edges, variables, version, is_published, enable_csat, deployed_at, created_at, updated_at)
    VALUES (
      new_scenario_id,
      rec.organization_id,
      COALESCE(a_name, 'Migrated Scenario') || ' (Auto)',
      'Automatically created during migration from direct phone number routing.',
      jsonb_build_array(
        jsonb_build_object(
          'id', node_id,
          'type', 'entry_agent',
          'position', jsonb_build_object('x', 250, 'y', 100),
          'data', jsonb_build_object(
            'assistant_id', rec.assistant_id::text,
            'label', COALESCE(a_name, 'Agent'),
            'avatar_url', NULL,
            'transfer_instruction', '',
            'inherit_voice', false,
            'send_greeting', true
          )
        )
      ),
      '[]'::jsonb,
      '{}'::jsonb,
      1,
      true,
      a_csat,
      NOW(),
      NOW(),
      NOW()
    );

    -- Assign scenario to phone number
    UPDATE phone_numbers
    SET scenario_id = new_scenario_id
    WHERE id = rec.phone_id;

    RAISE NOTICE 'Created scenario % for phone number %', new_scenario_id, rec.phone_number;
  END LOOP;
END $$;


-- ── 5. Remove assistant_id from phone_numbers ──────────────────────────────

-- Drop the trigger that freed phone numbers when assistants were deleted
DROP TRIGGER IF EXISTS free_phone_number_on_assistant_delete ON assistants;
DROP FUNCTION IF EXISTS free_phone_number_on_assistant_delete();

-- Drop the FK constraint and index
ALTER TABLE phone_numbers DROP CONSTRAINT IF EXISTS phone_numbers_assistant_id_fkey;
DROP INDEX IF EXISTS idx_phone_numbers_assistant;

-- Drop the column
ALTER TABLE phone_numbers DROP COLUMN IF EXISTS assistant_id;

-- Make scenario_id NOT NULL (all rows should have a value now after step 4)
-- First handle any orphans: phone numbers without scenario_id
DELETE FROM phone_numbers WHERE scenario_id IS NULL;

-- Only set NOT NULL if not already set
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phone_numbers' AND column_name = 'scenario_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE phone_numbers ALTER COLUMN scenario_id SET NOT NULL;
  END IF;
END $$;


-- ── 6. Drop enable_csat from assistants ─────────────────────────────────────

ALTER TABLE assistants DROP COLUMN IF EXISTS enable_csat;


-- ── 7. Prepare test_suites for scenario support (Phase 2) ──────────────────

ALTER TABLE test_suites
  ALTER COLUMN assistant_id DROP NOT NULL;

ALTER TABLE test_suites
  ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES call_scenarios(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'test_suites_target_check'
  ) THEN
    ALTER TABLE test_suites
      ADD CONSTRAINT test_suites_target_check
      CHECK (assistant_id IS NOT NULL OR scenario_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_test_suites_scenario ON test_suites(scenario_id);


-- ── 8. Prepare test_runs for scenario support (Phase 2) ─────────────────────

ALTER TABLE test_runs
  ALTER COLUMN assistant_id DROP NOT NULL;

ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES call_scenarios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_test_runs_scenario ON test_runs(scenario_id);
