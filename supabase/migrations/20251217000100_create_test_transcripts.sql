-- Create test_transcripts table for chat simulator messages
create table test_transcripts (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,

  -- Message details
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,

  -- Timing
  timestamp timestamp with time zone default now(),
  sequence_number integer not null, -- Order within the session

  -- Metadata (for LLM usage stats, tool calls, etc.)
  metadata jsonb default '{}'::jsonb,

  created_at timestamp with time zone default now()
);

-- Create indexes for performance
create index idx_test_transcripts_session on test_transcripts(test_session_id);
create index idx_test_transcripts_organization on test_transcripts(organization_id);
create index idx_test_transcripts_timestamp on test_transcripts(timestamp);
create index idx_test_transcripts_sequence on test_transcripts(test_session_id, sequence_number);

-- Enable Row Level Security
alter table test_transcripts enable row level security;

-- Policy: Users can view transcripts in their organizations
create policy "Users can view test transcripts in their org"
  on test_transcripts for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Policy: Users can create transcripts in their organizations
create policy "Users can create test transcripts in their org"
  on test_transcripts for insert
  with check (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
      and role in ('owner', 'admin', 'member')
    )
  );

-- Trigger to update parent session's last_message_at
create or replace function update_test_session_last_message()
returns trigger as $$
begin
  update test_sessions
  set last_message_at = new.timestamp
  where id = new.test_session_id;
  return new;
end;
$$ language plpgsql;

create trigger update_test_session_last_message_trigger
  after insert on test_transcripts
  for each row
  execute function update_test_session_last_message();
