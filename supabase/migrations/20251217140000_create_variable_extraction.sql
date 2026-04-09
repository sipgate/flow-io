-- Variable Extraction Feature
-- Allows defining variables per assistant that get extracted from conversations

-- Variable definitions (per assistant)
CREATE TABLE variable_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'date', 'phone', 'email')),
  required BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assistant_id, name)
);

-- Indexes for variable_definitions
CREATE INDEX idx_variable_definitions_assistant ON variable_definitions(assistant_id);
CREATE INDEX idx_variable_definitions_organization ON variable_definitions(organization_id);

-- Extracted variables (per call)
CREATE TABLE extracted_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  variable_definition_id UUID REFERENCES variable_definitions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT,
  confidence DECIMAL(3,2),
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for extracted_variables
CREATE INDEX idx_extracted_variables_call_session ON extracted_variables(call_session_id);
CREATE INDEX idx_extracted_variables_organization ON extracted_variables(organization_id);

-- Webhook configuration (per assistant)
CREATE TABLE variable_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  headers JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for variable_webhooks
CREATE INDEX idx_variable_webhooks_assistant ON variable_webhooks(assistant_id);
CREATE INDEX idx_variable_webhooks_organization ON variable_webhooks(organization_id);

-- Enable Row Level Security
ALTER TABLE variable_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for variable_definitions
CREATE POLICY "Users can view variable definitions in their org"
  ON variable_definitions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create variable definitions in their org"
  ON variable_definitions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Users can update variable definitions in their org"
  ON variable_definitions FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Users can delete variable definitions in their org"
  ON variable_definitions FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

-- RLS Policies for extracted_variables
CREATE POLICY "Users can view extracted variables in their org"
  ON extracted_variables FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert extracted variables"
  ON extracted_variables FOR INSERT
  WITH CHECK (true);

-- RLS Policies for variable_webhooks
CREATE POLICY "Users can view webhooks in their org"
  ON variable_webhooks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage webhooks in their org"
  ON variable_webhooks FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_variable_definitions_updated_at
  BEFORE UPDATE ON variable_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variable_webhooks_updated_at
  BEFORE UPDATE ON variable_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
