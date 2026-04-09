-- Rename phoneme → alias and drop alphabet column.
-- ElevenLabs Flash 2.5 does not support <phoneme> SSML tags; plain alias
-- replacement (alternate spellings) works with all models.

ALTER TABLE phoneme_set_entries
  RENAME COLUMN phoneme TO alias;

ALTER TABLE phoneme_set_entries
  DROP COLUMN alphabet;

-- Update the seeded example: IPA notation → usable alias spelling
UPDATE phoneme_set_entries
  SET alias = 'zipgate'
  WHERE word = 'sipgate' AND alias = 'ˈzɪpɡeɪt';
