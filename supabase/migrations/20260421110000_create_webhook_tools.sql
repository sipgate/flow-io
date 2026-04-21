-- Webhook Tools: per-assistant HTTP tools callable by the LLM
-- The LLM can invoke these as function calls; arguments are forwarded as JSON body (POST) or query params (GET).

CREATE TABLE webhook_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- LLM-facing definition
  name TEXT NOT NULL,                    -- snake_case tool name, e.g. "get_customer_info"
  description TEXT NOT NULL,            -- What the tool does (shown to LLM)

  -- HTTP config
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST' CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH')),
  headers JSONB DEFAULT '{}'::jsonb,
  auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'bearer', 'api_key')),
  auth_config JSONB DEFAULT '{}'::jsonb, -- { token } or { apiKey, headerName }
  timeout_ms INTEGER DEFAULT 10000,

  -- Parameter schema for LLM (array of {name, type, description, required})
  parameters JSONB DEFAULT '[]'::jsonb,

  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(assistant_id, name)
);

CREATE INDEX idx_webhook_tools_assistant ON webhook_tools(assistant_id);
CREATE INDEX idx_webhook_tools_organization ON webhook_tools(organization_id);

ALTER TABLE webhook_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view webhook tools in their org"
  ON webhook_tools FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage webhook tools in their org"
  ON webhook_tools FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE TRIGGER update_webhook_tools_updated_at
  BEFORE UPDATE ON webhook_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
