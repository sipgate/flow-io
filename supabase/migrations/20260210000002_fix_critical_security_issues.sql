-- Fix CRITICAL and HIGH security issues from audit
-- This migration is safe: all affected write paths use service_role client.

------------------------------------------------------------------------
-- CRITICAL 1: call_sessions — restrict "service role" policy to service_role
-- Currently: FOR ALL USING (true) without role restriction → any user can
-- INSERT/UPDATE/DELETE any call session across all orgs.
-- Authenticated SELECT is already handled by the org-scoped policy.
-- All webhook writes use createServiceRoleClient() → safe.
------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role can manage call sessions" ON call_sessions;
CREATE POLICY "Service role can manage call sessions"
  ON call_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

------------------------------------------------------------------------
-- CRITICAL 2: call_transcripts — same issue as call_sessions
-- All transcript writes use createServiceRoleClient() → safe.
------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role can manage transcripts" ON call_transcripts;
CREATE POLICY "Service role can manage transcripts"
  ON call_transcripts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

------------------------------------------------------------------------
-- CRITICAL 3: user_profiles — SELECT USING (true) exposes all emails/names
-- cross-org. Restrict to: own profile + profiles of users in same org(s).
-- Writes (insert/update own profile) are already correctly scoped.
--
-- Verified callers:
--   - profile page, auth callback → read own profile (createClient)
--   - getOrganizationMembers → uses serviceSupabase (unaffected by RLS)
------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view user profiles" ON user_profiles;
CREATE POLICY "Users can view profiles in their org or own"
  ON user_profiles FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR id IN (
      SELECT om2.user_id
      FROM organization_members om2
      WHERE om2.organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        WHERE om.user_id = (SELECT auth.uid())
      )
    )
  );

------------------------------------------------------------------------
-- HIGH 1: mcp_analytics_summary + mcp_popular_tools views
-- Missing security_invoker → bypass RLS, leak cross-org MCP data.
-- Both queried via createClient() with org_id filter.
-- Underlying tables (mcp_servers, mcp_tool_call_events) have org-scoped RLS.
------------------------------------------------------------------------

CREATE OR REPLACE VIEW mcp_analytics_summary
  WITH (security_invoker = on)
AS
SELECT
  s.id AS mcp_server_id,
  s.name AS server_name,
  s.organization_id,
  count(e.id) AS total_calls,
  count(DISTINCT e.call_session_id) AS unique_call_sessions,
  count(DISTINCT e.test_session_id) AS unique_test_sessions,
  count(DISTINCT e.assistant_id) AS unique_assistants,
  count(DISTINCT e.tool_name) AS unique_tools_used,
  avg(e.duration_ms)::integer AS avg_duration_ms,
  count(CASE WHEN e.error IS NOT NULL THEN 1 END) AS error_count,
  max(e.created_at) AS last_used_at
FROM mcp_servers s
LEFT JOIN mcp_tool_call_events e ON e.mcp_server_id = s.id
GROUP BY s.id, s.name, s.organization_id;

CREATE OR REPLACE VIEW mcp_popular_tools
  WITH (security_invoker = on)
AS
SELECT
  mcp_server_id,
  tool_name,
  count(*) AS call_count,
  avg(duration_ms)::integer AS avg_duration_ms,
  count(CASE WHEN error IS NOT NULL THEN 1 END) AS error_count,
  max(created_at) AS last_used_at
FROM mcp_tool_call_events
GROUP BY mcp_server_id, tool_name
ORDER BY call_count DESC;

------------------------------------------------------------------------
-- HIGH 2: Functions without SET search_path = ''
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_call_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION free_phone_number_on_assistant_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.phone_numbers
  SET assistant_id = NULL, assigned_at = NULL
  WHERE assistant_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = '';
