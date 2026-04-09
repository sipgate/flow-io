-- Call Criteria: Define pass/fail criteria for evaluating calls
-- Supports org-level defaults and assistant-specific overrides

-- Table for defining criteria
CREATE TABLE call_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE, -- NULL = org-level default
  name TEXT NOT NULL,  -- e.g., "Friendly tone"
  description TEXT NOT NULL,  -- e.g., "Agent must maintain a friendly and helpful tone throughout the call"
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,  -- for ordering
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX idx_call_criteria_org ON call_criteria(organization_id);
CREATE INDEX idx_call_criteria_assistant ON call_criteria(assistant_id);
CREATE INDEX idx_call_criteria_active ON call_criteria(organization_id, is_active) WHERE is_active = true;

-- Table for storing evaluation results
CREATE TABLE call_criteria_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES call_criteria(id) ON DELETE CASCADE,
  passed BOOLEAN NOT NULL,
  reasoning TEXT,  -- LLM explanation for the result
  evaluated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(call_session_id, criterion_id)
);

-- Index for fetching results by call
CREATE INDEX idx_call_criteria_results_session ON call_criteria_results(call_session_id);

-- Enable RLS
ALTER TABLE call_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_criteria_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_criteria
-- Users can view criteria for their organizations
CREATE POLICY "Users can view call criteria for their organizations"
  ON call_criteria FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Admins and owners can manage criteria
CREATE POLICY "Admins can manage call criteria"
  ON call_criteria FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for call_criteria_results
-- Users can view results for calls in their organizations
CREATE POLICY "Users can view call criteria results for their organizations"
  ON call_criteria_results FOR SELECT
  USING (
    call_session_id IN (
      SELECT cs.id FROM call_sessions cs
      WHERE cs.organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- Service role can insert/update results (for background evaluation)
CREATE POLICY "Service role can manage call criteria results"
  ON call_criteria_results FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admins can also manage results (for manual re-evaluation)
CREATE POLICY "Admins can manage call criteria results"
  ON call_criteria_results FOR ALL
  USING (
    call_session_id IN (
      SELECT cs.id FROM call_sessions cs
      WHERE cs.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    call_session_id IN (
      SELECT cs.id FROM call_sessions cs
      WHERE cs.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_criteria_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER call_criteria_updated_at
  BEFORE UPDATE ON call_criteria
  FOR EACH ROW
  EXECUTE FUNCTION update_call_criteria_updated_at();
