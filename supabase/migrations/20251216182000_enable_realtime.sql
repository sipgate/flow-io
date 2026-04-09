-- Enable Supabase Realtime for call_sessions table
-- This allows the frontend to subscribe to real-time changes

alter publication supabase_realtime add table call_sessions;

-- Also enable for call_transcripts for potential future use
alter publication supabase_realtime add table call_transcripts;
