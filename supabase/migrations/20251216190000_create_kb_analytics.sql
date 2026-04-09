-- Create KB search analytics tracking tables

-- KB Search Events (tracks every search performed)
create table kb_search_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  assistant_id uuid references assistants(id) on delete cascade not null,
  knowledge_base_id uuid references knowledge_bases(id) on delete cascade not null,
  call_session_id uuid references call_sessions(id) on delete cascade,
  query text not null,
  results_count integer default 0,
  search_duration_ms integer,
  created_at timestamptz default now()
);

-- KB Chunk Retrievals (tracks which chunks were returned in searches)
create table kb_chunk_retrievals (
  id uuid primary key default gen_random_uuid(),
  search_event_id uuid references kb_search_events(id) on delete cascade not null,
  chunk_id uuid references kb_chunks(id) on delete cascade not null,
  document_id uuid references kb_documents(id) on delete cascade not null,
  similarity_score float not null,
  rank integer not null,
  created_at timestamptz default now()
);

-- Indexes for analytics queries
create index idx_kb_search_events_org on kb_search_events(organization_id, created_at desc);
create index idx_kb_search_events_kb on kb_search_events(knowledge_base_id, created_at desc);
create index idx_kb_search_events_assistant on kb_search_events(assistant_id, created_at desc);
create index idx_kb_chunk_retrievals_search on kb_chunk_retrievals(search_event_id);
create index idx_kb_chunk_retrievals_chunk on kb_chunk_retrievals(chunk_id, created_at desc);

-- RLS policies
alter table kb_search_events enable row level security;
alter table kb_chunk_retrievals enable row level security;

create policy "Users can view search events in their org"
  on kb_search_events for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "Users can view chunk retrievals in their org"
  on kb_chunk_retrievals for select
  using (
    search_event_id in (
      select id from kb_search_events
      where organization_id in (
        select organization_id from organization_members
        where user_id = auth.uid()
      )
    )
  );

-- View for aggregated KB analytics
create or replace view kb_analytics_summary as
select
  kb.id as knowledge_base_id,
  kb.name as knowledge_base_name,
  kb.organization_id,
  count(distinct se.id) as total_searches,
  count(distinct se.call_session_id) as unique_calls,
  count(distinct se.assistant_id) as unique_assistants,
  avg(se.results_count) as avg_results_per_search,
  count(distinct cr.chunk_id) as unique_chunks_retrieved,
  max(se.created_at) as last_searched_at
from knowledge_bases kb
left join kb_search_events se on se.knowledge_base_id = kb.id
left join kb_chunk_retrievals cr on cr.search_event_id = se.id
group by kb.id, kb.name, kb.organization_id;

-- View for popular chunks
create or replace view kb_popular_chunks as
select
  c.id as chunk_id,
  c.content,
  c.knowledge_base_id,
  d.title as document_title,
  count(cr.id) as retrieval_count,
  avg(cr.similarity_score) as avg_similarity,
  max(cr.created_at) as last_retrieved_at
from kb_chunks c
join kb_documents d on d.id = c.document_id
left join kb_chunk_retrievals cr on cr.chunk_id = c.id
group by c.id, c.content, c.knowledge_base_id, d.title
having count(cr.id) > 0
order by retrieval_count desc;
