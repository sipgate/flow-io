-- MCP (Model Context Protocol) Servers
-- Organization-scoped MCP server configurations for external tool access

-- Main MCP servers table
create table mcp_servers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  url text not null,
  auth_type text check (auth_type in ('none', 'bearer', 'api_key')) default 'none',
  auth_config jsonb default '{}'::jsonb, -- Encrypted credentials (token, apiKey, headerName)
  headers jsonb default '{}'::jsonb, -- Custom headers to send with requests
  timeout_ms integer default 30000,
  is_active boolean default true,
  last_health_check timestamptz,
  health_status text check (health_status in ('healthy', 'unhealthy', 'unknown')) default 'unknown',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Junction table for many-to-many: assistants <-> MCP servers
create table assistant_mcp_servers (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references assistants(id) on delete cascade,
  mcp_server_id uuid not null references mcp_servers(id) on delete cascade,
  priority integer default 0, -- Higher priority servers are queried first
  created_at timestamptz default now(),
  unique(assistant_id, mcp_server_id)
);

-- Indexes for efficient querying
create index idx_mcp_servers_org on mcp_servers(organization_id);
create index idx_mcp_servers_active on mcp_servers(organization_id, is_active);
create index idx_assistant_mcp_assistant on assistant_mcp_servers(assistant_id);
create index idx_assistant_mcp_server on assistant_mcp_servers(mcp_server_id);
create index idx_assistant_mcp_priority on assistant_mcp_servers(assistant_id, priority desc);

-- Enable RLS
alter table mcp_servers enable row level security;
alter table assistant_mcp_servers enable row level security;

-- RLS policies for mcp_servers
create policy "Users can view MCP servers in their org"
  on mcp_servers for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "Admins can manage MCP servers in their org"
  on mcp_servers for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- RLS policies for assistant_mcp_servers (cascade through assistants)
create policy "Users can view assistant MCP assignments in their org"
  on assistant_mcp_servers for select
  using (
    assistant_id in (
      select id from assistants
      where organization_id in (
        select organization_id from organization_members
        where user_id = auth.uid()
      )
    )
  );

create policy "Admins can manage assistant MCP assignments in their org"
  on assistant_mcp_servers for all
  using (
    assistant_id in (
      select id from assistants
      where organization_id in (
        select organization_id from organization_members
        where user_id = auth.uid() and role in ('owner', 'admin')
      )
    )
  );

-- Trigger to update updated_at timestamp
create trigger update_mcp_servers_updated_at
  before update on mcp_servers
  for each row
  execute function update_updated_at_column();
