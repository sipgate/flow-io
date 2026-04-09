-- Call Tools: Agent actions during calls (hangup, forward, take note)
-- These are LLM tools the assistant can use to control the call flow

-- Configuration for call tools (per assistant)
CREATE TABLE call_tool_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Hangup tool
  hangup_enabled BOOLEAN DEFAULT false,
  hangup_instructions TEXT, -- When to use this tool

  -- Forward/Transfer tool
  forward_enabled BOOLEAN DEFAULT false,
  forward_phone_number TEXT, -- E.164 format: +1234567890
  forward_caller_id_name TEXT, -- Name shown to recipient
  forward_caller_id_number TEXT, -- Number shown to recipient
  forward_instructions TEXT, -- When to use this tool

  -- Take Note tool
  note_enabled BOOLEAN DEFAULT false,
  note_instructions TEXT, -- When to use this tool

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assistant_id)
);

-- Notes taken by the assistant during calls
CREATE TABLE call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assistant_id UUID REFERENCES assistants(id) ON DELETE SET NULL,

  content TEXT NOT NULL,
  category TEXT, -- Optional category: "action_required", "follow_up", "info", etc.
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),

  -- When in the conversation this note was taken
  conversation_context TEXT, -- Brief context of what was being discussed

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE call_tool_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_notes ENABLE ROW LEVEL SECURITY;

-- Call tool configs: organization members can manage
CREATE POLICY "Users can view call tool configs for their organization"
  ON call_tool_configs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert call tool configs for their organization"
  ON call_tool_configs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update call tool configs for their organization"
  ON call_tool_configs FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete call tool configs for their organization"
  ON call_tool_configs FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Call notes: organization members can view and create
CREATE POLICY "Users can view call notes for their organization"
  ON call_notes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert call notes for their organization"
  ON call_notes FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update call notes for their organization"
  ON call_notes FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete call notes for their organization"
  ON call_notes FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_call_tool_configs_assistant ON call_tool_configs(assistant_id);
CREATE INDEX idx_call_tool_configs_org ON call_tool_configs(organization_id);
CREATE INDEX idx_call_notes_session ON call_notes(call_session_id);
CREATE INDEX idx_call_notes_org ON call_notes(organization_id);
CREATE INDEX idx_call_notes_created ON call_notes(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_call_tool_configs_updated_at
  BEFORE UPDATE ON call_tool_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
