-- Add OAuth 2.1 support for MCP servers (RFC 8252 / MCP Auth spec 2025-03-26)
--
-- Storage strategy: keep credentials inside the existing `auth_config` JSONB
-- (consistent with bearer/api_key storage) and add a small set of dedicated
-- columns for the *non-secret* OAuth metadata that we need to query/inspect
-- (endpoints, client_id, scope, expiry, status).

alter table mcp_servers
  drop constraint if exists mcp_servers_auth_type_check;

alter table mcp_servers
  add constraint mcp_servers_auth_type_check
  check (auth_type in ('none', 'bearer', 'api_key', 'oauth2'));

alter table mcp_servers
  add column if not exists oauth_authorization_endpoint text,
  add column if not exists oauth_token_endpoint text,
  add column if not exists oauth_registration_endpoint text,
  add column if not exists oauth_scope text,
  add column if not exists oauth_resource text,
  add column if not exists oauth_client_id text,
  add column if not exists oauth_token_expires_at timestamptz,
  add column if not exists oauth_connected_at timestamptz;

-- Pending OAuth authorization requests (state/PKCE verifier for callback)
create table if not exists mcp_oauth_states (
  state text primary key,
  mcp_server_id uuid not null references mcp_servers(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  redirect_uri text not null,
  return_to text,
  created_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists idx_mcp_oauth_states_server on mcp_oauth_states(mcp_server_id);
create index if not exists idx_mcp_oauth_states_expires on mcp_oauth_states(expires_at);

alter table mcp_oauth_states enable row level security;

-- Only the user who started the flow can read their own state row;
-- callback route uses service role anyway, so no INSERT/DELETE policies needed.
create policy "Users read their own MCP OAuth states"
  on mcp_oauth_states for select
  using (user_id = auth.uid());
