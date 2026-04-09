-- Migration: Rename call_flows to call_scenarios and update all references
-- This renames the "flows" concept to "scenarios" throughout the database schema.

-- ── 1. Rename call_flows → call_scenarios ────────────────────────────────────

ALTER TABLE call_flows RENAME TO call_scenarios;

-- Rename primary key constraint
ALTER TABLE call_scenarios RENAME CONSTRAINT call_flows_pkey TO call_scenarios_pkey;

-- Rename indexes
ALTER INDEX IF EXISTS call_flows_organization_id_idx RENAME TO call_scenarios_organization_id_idx;
ALTER INDEX IF EXISTS call_flows_is_published_idx RENAME TO call_scenarios_is_published_idx;


-- ── 2. Rename call_flow_versions → call_scenario_versions ────────────────────

ALTER TABLE call_flow_versions RENAME TO call_scenario_versions;

-- Rename primary key constraint
ALTER TABLE call_scenario_versions RENAME CONSTRAINT call_flow_versions_pkey TO call_scenario_versions_pkey;

-- Rename flow_id column to scenario_id in call_scenario_versions
ALTER TABLE call_scenario_versions RENAME COLUMN flow_id TO scenario_id;

-- Drop old FK constraint and recreate with new name
ALTER TABLE call_scenario_versions DROP CONSTRAINT IF EXISTS call_flow_versions_flow_id_fkey;
ALTER TABLE call_scenario_versions ADD CONSTRAINT call_scenario_versions_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES call_scenarios(id) ON DELETE CASCADE;


-- ── 3. Rename flow_id → scenario_id in phone_numbers ─────────────────────────

ALTER TABLE phone_numbers RENAME COLUMN flow_id TO scenario_id;

-- Drop old FK constraint and recreate with new name
ALTER TABLE phone_numbers DROP CONSTRAINT IF EXISTS phone_numbers_flow_id_fkey;
ALTER TABLE phone_numbers ADD CONSTRAINT phone_numbers_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES call_scenarios(id) ON DELETE SET NULL;

-- Rename index on phone_numbers.scenario_id if it exists
ALTER INDEX IF EXISTS phone_numbers_flow_id_idx RENAME TO phone_numbers_scenario_id_idx;


-- ── 4. Rename flow_id → scenario_id in call_sessions ─────────────────────────

ALTER TABLE call_sessions RENAME COLUMN flow_id TO scenario_id;

-- Drop old FK constraint and recreate with new name
ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS call_sessions_flow_id_fkey;
ALTER TABLE call_sessions ADD CONSTRAINT call_sessions_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES call_scenarios(id) ON DELETE SET NULL;

-- Rename index on call_sessions.scenario_id if it exists
ALTER INDEX IF EXISTS call_sessions_flow_id_idx RENAME TO call_sessions_scenario_id_idx;


-- ── 5. Rename flow_id → scenario_id in assistants (if column exists) ─────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assistants' AND column_name = 'flow_id'
  ) THEN
    ALTER TABLE assistants RENAME COLUMN flow_id TO scenario_id;
  END IF;
END $$;


-- ── 6. Update RLS policies for call_scenarios ─────────────────────────────────

-- Drop old policies if they were named after call_flows
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'call_scenarios'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON call_scenarios', pol.policyname);
  END LOOP;
END $$;

-- Recreate RLS policies for call_scenarios
ALTER TABLE call_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scenarios in their organization"
  ON call_scenarios FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert scenarios"
  ON call_scenarios FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Admins can update scenarios"
  ON call_scenarios FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Admins can delete scenarios"
  ON call_scenarios FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );


-- ── 7. Update RLS policies for call_scenario_versions ────────────────────────

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'call_scenario_versions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON call_scenario_versions', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE call_scenario_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scenario versions in their organization"
  ON call_scenario_versions FOR SELECT
  USING (
    scenario_id IN (
      SELECT id FROM call_scenarios
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role can insert scenario versions"
  ON call_scenario_versions FOR INSERT
  WITH CHECK (true);
