-- Add include_transcript option to variable_webhooks
-- When enabled, the full call transcript is included in the webhook payload

ALTER TABLE variable_webhooks
  ADD COLUMN include_transcript BOOLEAN DEFAULT false;
