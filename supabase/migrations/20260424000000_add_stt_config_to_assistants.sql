-- STT provider and language configuration per assistant
ALTER TABLE assistants
  ADD COLUMN stt_provider TEXT CHECK (stt_provider IN ('AZURE', 'DEEPGRAM', 'ELEVEN_LABS')),
  ADD COLUMN stt_languages TEXT[];

ALTER TABLE assistant_versions
  ADD COLUMN stt_provider TEXT,
  ADD COLUMN stt_languages TEXT[];
