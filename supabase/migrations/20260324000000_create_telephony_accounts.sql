-- Telephony provider accounts (org-scoped, supports multiple providers)
CREATE TABLE telephony_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'sipgate',
  provider_account_id text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  account_info jsonb DEFAULT '{}',
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider)
);

-- Auto-update updated_at
CREATE TRIGGER update_telephony_accounts_updated_at
  BEFORE UPDATE ON telephony_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE telephony_accounts ENABLE ROW LEVEL SECURITY;

-- Owner/admin of the org can read their telephony accounts
CREATE POLICY "org_members_can_view_telephony_accounts"
  ON telephony_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = telephony_accounts.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Only owner/admin can manage telephony accounts
CREATE POLICY "org_admins_can_manage_telephony_accounts"
  ON telephony_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = telephony_accounts.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Add telephony_account_id and provider_phone_id to phone_numbers
ALTER TABLE phone_numbers
  ADD COLUMN telephony_account_id uuid REFERENCES telephony_accounts(id) ON DELETE SET NULL,
  ADD COLUMN provider_phone_id text;
