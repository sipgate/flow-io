-- Add AI Flow endpoint ID to telephony accounts
-- This stores the sipgate AI Flow UUID used for automatic routing
ALTER TABLE telephony_accounts
  ADD COLUMN flow_endpoint_id text;
