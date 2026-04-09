-- Create call_transcripts table for storing conversation messages
create table call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references call_sessions(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,

  -- Message details
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,

  -- Timing
  timestamp timestamp with time zone default now(),
  sequence_number integer not null, -- Order within the call

  -- Metadata from sipgate
  event_type text, -- e.g., 'UserSpeak', 'AssistantSpeak'
  metadata jsonb default '{}'::jsonb,

  created_at timestamp with time zone default now()
);

-- Create indexes for performance
create index idx_call_transcripts_session on call_transcripts(call_session_id);
create index idx_call_transcripts_organization on call_transcripts(organization_id);
create index idx_call_transcripts_timestamp on call_transcripts(timestamp);
create index idx_call_transcripts_sequence on call_transcripts(call_session_id, sequence_number);

-- Enable Row Level Security
alter table call_transcripts enable row level security;

-- Policy: Users can view transcripts in their organizations
create policy "Users can view transcripts in their org"
  on call_transcripts for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Policy: Service role can manage all transcripts (for webhook)
create policy "Service role can manage transcripts"
  on call_transcripts for all
  using (true)
  with check (true);
