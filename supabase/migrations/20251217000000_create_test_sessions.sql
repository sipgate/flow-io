-- Create test_sessions table for chat simulator
create table test_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade,

  -- Session metadata
  name text, -- Optional name for the test session
  status text not null default 'active' check (status in ('active', 'archived')),

  -- Timestamps
  started_at timestamp with time zone default now(),
  last_message_at timestamp with time zone default now(),

  -- Metadata
  metadata jsonb default '{}'::jsonb,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for performance
create index idx_test_sessions_organization on test_sessions(organization_id);
create index idx_test_sessions_assistant on test_sessions(assistant_id);
create index idx_test_sessions_status on test_sessions(status);
create index idx_test_sessions_last_message on test_sessions(last_message_at desc);

-- Enable Row Level Security
alter table test_sessions enable row level security;

-- Policy: Users can view test sessions in their organizations
create policy "Users can view test sessions in their org"
  on test_sessions for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Policy: Users can create test sessions in their organizations
create policy "Users can create test sessions in their org"
  on test_sessions for insert
  with check (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
      and role in ('owner', 'admin', 'member')
    )
  );

-- Policy: Users can update test sessions in their organizations
create policy "Users can update test sessions in their org"
  on test_sessions for update
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
      and role in ('owner', 'admin', 'member')
    )
  );

-- Policy: Users can delete test sessions in their organizations
create policy "Users can delete test sessions in their org"
  on test_sessions for delete
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
      and role in ('owner', 'admin', 'member')
    )
  );

-- Function to update updated_at and last_message_at
create or replace function update_test_session_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_test_sessions_updated_at
  before update on test_sessions
  for each row
  execute function update_test_session_updated_at();
