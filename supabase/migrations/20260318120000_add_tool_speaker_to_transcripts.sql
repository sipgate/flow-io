-- Allow 'tool' speaker type in call_transcripts for recording tool/function calls
ALTER TABLE call_transcripts
  DROP CONSTRAINT IF EXISTS call_transcripts_speaker_check;

ALTER TABLE call_transcripts
  ADD CONSTRAINT call_transcripts_speaker_check
  CHECK (speaker IN ('user', 'assistant', 'system', 'tool'));
