-- Create prompt_versions table for tracking system prompt history
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_prompt TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  UNIQUE(assistant_id, version_number)
);

-- Create index for faster lookups
CREATE INDEX idx_prompt_versions_assistant ON prompt_versions(assistant_id, version_number DESC);
CREATE INDEX idx_prompt_versions_org ON prompt_versions(organization_id);

-- Enable RLS
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view prompt versions for their organization"
  ON prompt_versions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert prompt versions"
  ON prompt_versions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Add comment for documentation
COMMENT ON TABLE prompt_versions IS 'Stores version history of assistant system prompts';
COMMENT ON COLUMN prompt_versions.version_number IS 'Auto-incrementing version number per assistant';
COMMENT ON COLUMN prompt_versions.note IS 'Optional note describing the change';
