-- Add cached tools column to MCP servers
-- This stores the tool signatures so we don't need to fetch them on every request

alter table mcp_servers add column cached_tools jsonb;
alter table mcp_servers add column tools_fetched_at timestamptz;

-- Add comment for documentation
comment on column mcp_servers.cached_tools is 'Cached MCP tool signatures fetched when server is saved/tested';
comment on column mcp_servers.tools_fetched_at is 'When the cached tools were last fetched';
