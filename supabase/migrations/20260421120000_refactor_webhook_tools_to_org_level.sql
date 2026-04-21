-- Refactor webhook_tools: org-level resource (like mcp_servers) with junction table

-- Drop per-assistant table
DROP TABLE IF EXISTS webhook_tools;

-- Org-level webhook tools (like mcp_servers)
CREATE TABLE webhook_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST' CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH')),
  headers JSONB DEFAULT '{}'::jsonb,
  auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'bearer', 'api_key')),
  auth_config JSONB DEFAULT '{}'::jsonb,
  timeout_ms INTEGER DEFAULT 10000,
  parameters JSONB DEFAULT '[]'::jsonb,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table: assistants <-> webhook_tools (like assistant_mcp_servers)
CREATE TABLE assistant_webhook_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  webhook_tool_id UUID NOT NULL REFERENCES webhook_tools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assistant_id, webhook_tool_id)
);

CREATE INDEX idx_webhook_tools_org ON webhook_tools(organization_id);
CREATE INDEX idx_assistant_webhook_tools_assistant ON assistant_webhook_tools(assistant_id);
CREATE INDEX idx_assistant_webhook_tools_tool ON assistant_webhook_tools(webhook_tool_id);

ALTER TABLE webhook_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_webhook_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view webhook tools in their org"
  ON webhook_tools FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage webhook tools in their org"
  ON webhook_tools FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

CREATE POLICY "Users can view assistant webhook tool assignments in their org"
  ON assistant_webhook_tools FOR SELECT
  USING (assistant_id IN (
    SELECT id FROM assistants WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Admins can manage assistant webhook tool assignments in their org"
  ON assistant_webhook_tools FOR ALL
  USING (assistant_id IN (
    SELECT id FROM assistants WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  ));

CREATE TRIGGER update_webhook_tools_updated_at
  BEFORE UPDATE ON webhook_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
