-- Add flow_id to phone_numbers so a number can route directly to a call flow
-- When flow_id is set, the webhook will use the flow's entry agent (flow_id takes precedence over assistant_id)
ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS flow_id uuid REFERENCES call_flows(id) ON DELETE SET NULL;

-- Index for webhook lookup performance
CREATE INDEX IF NOT EXISTS phone_numbers_flow_id_idx ON phone_numbers(flow_id);

-- Update the RLS policy for phone_numbers to also allow reading flow_id
-- (Existing policies cover the table; the new column is included automatically)
