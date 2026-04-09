-- MCP Tool Call Analytics
-- Track every MCP tool execution for analytics and debugging

create table mcp_tool_call_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade,
  mcp_server_id uuid not null references mcp_servers(id) on delete cascade,
  call_session_id uuid references call_sessions(id) on delete cascade, -- Nullable for test chat sessions
  test_session_id uuid, -- For test chat sessions (no FK to avoid circular deps)
  tool_name text not null,
  arguments jsonb not null,
  result jsonb,
  error text,
  duration_ms integer,
  created_at timestamptz default now()
);

-- Indexes for analytics queries
create index idx_mcp_events_org on mcp_tool_call_events(organization_id, created_at desc);
create index idx_mcp_events_server on mcp_tool_call_events(mcp_server_id, created_at desc);
create index idx_mcp_events_assistant on mcp_tool_call_events(assistant_id, created_at desc);
create index idx_mcp_events_session on mcp_tool_call_events(call_session_id);
create index idx_mcp_events_test_session on mcp_tool_call_events(test_session_id);
create index idx_mcp_events_tool on mcp_tool_call_events(tool_name, created_at desc);

-- Enable RLS
alter table mcp_tool_call_events enable row level security;

-- RLS policy: Users can view MCP events in their org
create policy "Users can view MCP events in their org"
  on mcp_tool_call_events for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Insert policy for service role (analytics tracking happens server-side)
-- Regular users don't insert directly, service role handles it
create policy "Service can insert MCP events"
  on mcp_tool_call_events for insert
  with check (true);

-- Analytics summary view
create or replace view mcp_analytics_summary as
select
  s.id as mcp_server_id,
  s.name as server_name,
  s.organization_id,
  count(e.id) as total_calls,
  count(distinct e.call_session_id) as unique_call_sessions,
  count(distinct e.test_session_id) as unique_test_sessions,
  count(distinct e.assistant_id) as unique_assistants,
  count(distinct e.tool_name) as unique_tools_used,
  avg(e.duration_ms)::integer as avg_duration_ms,
  count(case when e.error is not null then 1 end) as error_count,
  max(e.created_at) as last_used_at
from mcp_servers s
left join mcp_tool_call_events e on e.mcp_server_id = s.id
group by s.id, s.name, s.organization_id;

-- Popular tools view
create or replace view mcp_popular_tools as
select
  mcp_server_id,
  tool_name,
  count(*) as call_count,
  avg(duration_ms)::integer as avg_duration_ms,
  count(case when error is not null then 1 end) as error_count,
  max(created_at) as last_used_at
from mcp_tool_call_events
group by mcp_server_id, tool_name
order by call_count desc;
