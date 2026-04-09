-- Add deploy tracking to assistants
ALTER TABLE assistants
  ADD COLUMN deployed_at TIMESTAMPTZ,
  ADD COLUMN deployed_version INTEGER NOT NULL DEFAULT 0;

-- Snapshot table for deployed assistant configurations
CREATE TABLE assistant_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT,
  llm_provider TEXT,
  llm_model TEXT,
  llm_temperature FLOAT,
  thinking_level TEXT,
  voice_provider TEXT,
  voice_id TEXT,
  voice_language TEXT,
  opening_message TEXT,
  enable_csat BOOLEAN,
  enable_hesitation BOOLEAN,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assistant_id, version)
);

ALTER TABLE assistant_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view assistant versions"
  ON assistant_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assistants a
      JOIN organization_members om ON om.organization_id = a.organization_id
      WHERE a.id = assistant_versions.assistant_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage assistant versions"
  ON assistant_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM assistants a
      JOIN organization_members om ON om.organization_id = a.organization_id
      WHERE a.id = assistant_versions.assistant_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'member')
    )
  );
