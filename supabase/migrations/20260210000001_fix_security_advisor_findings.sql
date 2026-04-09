-- Fix all Supabase Security Advisor findings
-- ERRORs: Security Definer Views
-- WARNs: Function search_path mutable, RLS policies always true

------------------------------------------------------------------------
-- 1. Fix SECURITY DEFINER views → use security_invoker = on
------------------------------------------------------------------------

CREATE OR REPLACE VIEW kb_analytics_summary
  WITH (security_invoker = on)
AS
SELECT
  kb.id AS knowledge_base_id,
  kb.name AS knowledge_base_name,
  kb.organization_id,
  count(DISTINCT se.id) AS total_searches,
  count(DISTINCT se.call_session_id) AS unique_calls,
  count(DISTINCT se.assistant_id) AS unique_assistants,
  avg(se.results_count) AS avg_results_per_search,
  count(DISTINCT cr.chunk_id) AS unique_chunks_retrieved,
  max(se.created_at) AS last_searched_at
FROM knowledge_bases kb
LEFT JOIN kb_search_events se ON se.knowledge_base_id = kb.id
LEFT JOIN kb_chunk_retrievals cr ON cr.search_event_id = se.id
GROUP BY kb.id, kb.name, kb.organization_id;

CREATE OR REPLACE VIEW kb_popular_chunks
  WITH (security_invoker = on)
AS
SELECT
  c.id AS chunk_id,
  c.content,
  c.knowledge_base_id,
  d.title AS document_title,
  count(cr.id) AS retrieval_count,
  avg(cr.similarity_score) AS avg_similarity,
  max(cr.created_at) AS last_retrieved_at
FROM kb_chunks c
JOIN kb_documents d ON d.id = c.document_id
LEFT JOIN kb_chunk_retrievals cr ON cr.chunk_id = c.id
GROUP BY c.id, c.content, c.knowledge_base_id, d.title
HAVING count(cr.id) > 0
ORDER BY retrieval_count DESC;

------------------------------------------------------------------------
-- 2. Fix mutable search_path on functions → SET search_path = ''
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION update_test_session_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.test_sessions
  SET last_message_at = NEW.timestamp
  WHERE id = NEW.test_session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION update_test_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION update_call_criteria_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding vector(1536),
  kb_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  chunk_index integer,
  metadata jsonb
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    public.kb_chunks.id,
    public.kb_chunks.content,
    1 - (public.kb_chunks.embedding <=> query_embedding) AS similarity,
    public.kb_chunks.chunk_index,
    public.kb_chunks.metadata
  FROM public.kb_chunks
  WHERE public.kb_chunks.knowledge_base_id = kb_id
    AND 1 - (public.kb_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY public.kb_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

------------------------------------------------------------------------
-- 3. Fix overly permissive RLS policies → restrict to service_role
------------------------------------------------------------------------

-- extracted_variables: only service_role should insert
DROP POLICY IF EXISTS "Service role can insert extracted variables" ON extracted_variables;
CREATE POLICY "Service role can insert extracted variables"
  ON extracted_variables FOR INSERT
  TO service_role
  WITH CHECK (true);

-- mcp_tool_call_events: only service_role should insert
DROP POLICY IF EXISTS "Service role can insert MCP events" ON mcp_tool_call_events;
DROP POLICY IF EXISTS "Service can insert MCP events" ON mcp_tool_call_events;
CREATE POLICY "Service role can insert MCP events"
  ON mcp_tool_call_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- organizations: restrict to authenticated users
DROP POLICY IF EXISTS "Users can insert organizations" ON organizations;
CREATE POLICY "Authenticated users can insert organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);
