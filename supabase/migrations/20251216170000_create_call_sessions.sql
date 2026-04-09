-- Create call_sessions table for tracking calls
create table call_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique, -- sipgate session ID
  organization_id uuid not null references organizations(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade,
  phone_number_id uuid references phone_numbers(id) on delete set null,

  -- Call details from sipgate
  to_phone_number text not null, -- The sipgate number that received the call
  from_phone_number text not null, -- The caller's number
  direction text not null check (direction in ('inbound', 'outbound')),

  -- Call status
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'no_answer')),

  -- Timestamps
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  duration_seconds integer,

  -- Metadata
  metadata jsonb default '{}'::jsonb,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for performance
create index idx_call_sessions_session_id on call_sessions(session_id);
create index idx_call_sessions_organization on call_sessions(organization_id);
create index idx_call_sessions_assistant on call_sessions(assistant_id);
create index idx_call_sessions_phone_number on call_sessions(phone_number_id);
create index idx_call_sessions_status on call_sessions(status);
create index idx_call_sessions_started_at on call_sessions(started_at desc);

-- Enable Row Level Security
alter table call_sessions enable row level security;

-- Policy: Users can view call sessions in their organizations
create policy "Users can view call sessions in their org"
  on call_sessions for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Policy: Service role can manage all call sessions (for webhook)
create policy "Service role can manage call sessions"
  on call_sessions for all
  using (true)
  with check (true);

-- Function to update updated_at timestamp
create or replace function update_call_session_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_call_sessions_updated_at
  before update on call_sessions
  for each row
  execute function update_call_session_updated_at();
