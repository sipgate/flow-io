-- Add per-entry toggles for STT (boost_recognition) and TTS (replace_pronunciation)
-- Default both to true so existing entries keep their current behavior

ALTER TABLE phoneme_set_entries
  ADD COLUMN boost_recognition BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN replace_pronunciation BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN phoneme_set_entries.boost_recognition IS 'When true, the word is sent as custom_vocabulary to sipgate Flow for STT boosting';
COMMENT ON COLUMN phoneme_set_entries.replace_pronunciation IS 'When true, the word is replaced with its alias before TTS synthesis';
