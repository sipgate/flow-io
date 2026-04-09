-- Phoneme Sets: Named sets of word→IPA/CMU pronunciation mappings
-- Assigned to assistants; applied to ElevenLabs TTS output before synthesis

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE phoneme_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE phoneme_set_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phoneme_set_id UUID NOT NULL REFERENCES phoneme_sets(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  phoneme TEXT NOT NULL,          -- IPA or CMU Arpabet notation
  alphabet TEXT NOT NULL DEFAULT 'ipa',  -- 'ipa' | 'cmu-arpabet'
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(phoneme_set_id, word)
);

-- Junction table: assistants ↔ phoneme_sets (many-to-many)
CREATE TABLE assistant_phoneme_sets (
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  phoneme_set_id UUID NOT NULL REFERENCES phoneme_sets(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,  -- lower = higher priority on conflict
  PRIMARY KEY (assistant_id, phoneme_set_id)
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_phoneme_sets_org ON phoneme_sets(organization_id);
CREATE INDEX idx_phoneme_set_entries_set ON phoneme_set_entries(phoneme_set_id);
CREATE INDEX idx_phoneme_set_entries_active ON phoneme_set_entries(phoneme_set_id, is_active) WHERE is_active = true;
CREATE INDEX idx_assistant_phoneme_sets_assistant ON assistant_phoneme_sets(assistant_id);

-- ============================================================
-- updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_phoneme_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER phoneme_sets_updated_at
  BEFORE UPDATE ON phoneme_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_phoneme_sets_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE phoneme_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE phoneme_set_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_phoneme_sets ENABLE ROW LEVEL SECURITY;

-- phoneme_sets: all org members can read
CREATE POLICY "Org members can view phoneme sets"
  ON phoneme_sets FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- phoneme_sets: admins/owners can write
CREATE POLICY "Admins can manage phoneme sets"
  ON phoneme_sets FOR ALL
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

-- phoneme_sets: service role bypass
CREATE POLICY "Service role can manage phoneme sets"
  ON phoneme_sets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- phoneme_set_entries: all org members can read (via set's org)
CREATE POLICY "Org members can view phoneme set entries"
  ON phoneme_set_entries FOR SELECT
  USING (
    phoneme_set_id IN (
      SELECT ps.id FROM phoneme_sets ps
      WHERE ps.organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- phoneme_set_entries: admins/owners can write
CREATE POLICY "Admins can manage phoneme set entries"
  ON phoneme_set_entries FOR ALL
  USING (
    phoneme_set_id IN (
      SELECT ps.id FROM phoneme_sets ps
      WHERE ps.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    phoneme_set_id IN (
      SELECT ps.id FROM phoneme_sets ps
      WHERE ps.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- phoneme_set_entries: service role bypass
CREATE POLICY "Service role can manage phoneme set entries"
  ON phoneme_set_entries FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- assistant_phoneme_sets: all org members can read
CREATE POLICY "Org members can view assistant phoneme set assignments"
  ON assistant_phoneme_sets FOR SELECT
  USING (
    assistant_id IN (
      SELECT a.id FROM assistants a
      WHERE a.organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- assistant_phoneme_sets: admins/owners can write
CREATE POLICY "Admins can manage assistant phoneme set assignments"
  ON assistant_phoneme_sets FOR ALL
  USING (
    assistant_id IN (
      SELECT a.id FROM assistants a
      WHERE a.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    assistant_id IN (
      SELECT a.id FROM assistants a
      WHERE a.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- assistant_phoneme_sets: service role bypass
CREATE POLICY "Service role can manage assistant phoneme set assignments"
  ON assistant_phoneme_sets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Default seed: "Deutsch" set with sipgate → ˈzɪpɡeɪt for all orgs
-- ============================================================

DO $$
DECLARE
  org_record RECORD;
  new_set_id UUID;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    INSERT INTO phoneme_sets (organization_id, name, description)
    VALUES (org_record.id, 'Deutsch', 'Standard German pronunciation corrections')
    RETURNING id INTO new_set_id;

    INSERT INTO phoneme_set_entries (phoneme_set_id, word, phoneme, alphabet, position)
    VALUES (new_set_id, 'sipgate', 'ˈzɪpɡeɪt', 'ipa', 0);
  END LOOP;
END;
$$;
