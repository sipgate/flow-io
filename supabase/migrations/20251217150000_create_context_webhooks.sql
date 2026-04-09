-- Context webhooks: Called at call start to fetch external data to inject into prompt
-- This allows customers to pass customer-specific context (CRM data, order info, etc.) to the assistant

CREATE TABLE context_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Context Webhook',
  url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  headers JSONB DEFAULT '{}'::jsonb,
  timeout_ms INTEGER DEFAULT 5000,
  -- What data to send in the request
  include_caller_number BOOLEAN DEFAULT true,
  include_called_number BOOLEAN DEFAULT true,
  include_call_direction BOOLEAN DEFAULT true,
  -- Response handling
  response_variable_prefix TEXT DEFAULT 'context', -- Variables will be {{context.field_name}}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assistant_id) -- One context webhook per assistant
);

-- Store context data fetched for each call
CREATE TABLE call_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  context_webhook_id UUID REFERENCES context_webhooks(id) ON DELETE SET NULL,
  context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetch_duration_ms INTEGER,
  fetch_status TEXT CHECK (fetch_status IN ('success', 'error', 'timeout', 'skipped')),
  error_message TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE context_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_context ENABLE ROW LEVEL SECURITY;

-- Context webhooks: organization members can manage
CREATE POLICY "Users can view context webhooks for their organization"
  ON context_webhooks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert context webhooks for their organization"
  ON context_webhooks FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update context webhooks for their organization"
  ON context_webhooks FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete context webhooks for their organization"
  ON context_webhooks FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Call context: organization members can view
CREATE POLICY "Users can view call context for their organization"
  ON call_context FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert call context for their organization"
  ON call_context FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_context_webhooks_assistant ON context_webhooks(assistant_id);
CREATE INDEX idx_context_webhooks_org ON context_webhooks(organization_id);
CREATE INDEX idx_call_context_session ON call_context(call_session_id);
CREATE INDEX idx_call_context_org ON call_context(organization_id);

-- Trigger for updated_at
CREATE TRIGGER update_context_webhooks_updated_at
  BEFORE UPDATE ON context_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
