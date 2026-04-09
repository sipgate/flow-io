-- Add flow_id to call_sessions so flow-routed calls are traceable
ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS flow_id uuid REFERENCES call_flows(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS call_sessions_flow_id_idx ON call_sessions(flow_id);
