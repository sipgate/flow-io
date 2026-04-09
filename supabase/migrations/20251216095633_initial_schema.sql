-- Enable required extensions
create extension if not exists "vector";

-- =====================================================
-- ORGANIZATIONS & USERS
-- =====================================================

-- Organizations (Workspaces/Tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  settings jsonb default '{}'::jsonb,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'pro', 'enterprise')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User Profiles (extends Supabase Auth)
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Organization Members (Many-to-Many with Roles)
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references user_profiles(id) on delete cascade not null,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  invited_by uuid references user_profiles(id),
  joined_at timestamptz default now(),
  unique(organization_id, user_id)
);

-- =====================================================
-- CALL FLOWS & ASSISTANTS
-- =====================================================

-- Call Flows (Visual Flow Builder Definitions)
create table call_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  description text,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  variables jsonb default '{}'::jsonb,
  version integer default 1,
  is_published boolean default false,
  created_by uuid references user_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Call Flow Versions (for versioning and rollback)
create table call_flow_versions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid references call_flows(id) on delete cascade not null,
  version integer not null,
  nodes jsonb not null,
  edges jsonb not null,
  variables jsonb default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references user_profiles(id),
  created_at timestamptz default now(),
  unique(flow_id, version)
);

-- AI Assistants
create table assistants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  description text,
  voice_config jsonb default '{}'::jsonb, -- TTS provider, voice ID, language, etc.
  personality text,
  system_prompt text,
  llm_provider text check (llm_provider in ('openai', 'gemini')),
  llm_model text,
  temperature float default 0.7,
  max_tokens integer default 1000,
  flow_id uuid references call_flows(id),
  knowledge_base_id uuid,
  is_active boolean default true,
  created_by uuid references user_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- TELEPHONY
-- =====================================================

-- Phone Numbers
create table phone_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  phone_number text unique not null,
  provider text default 'sipgate',
  provider_config jsonb default '{}'::jsonb,
  assistant_id uuid references assistants(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Call Sessions
create table call_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  assistant_id uuid references assistants(id),
  phone_number_id uuid references phone_numbers(id),
  session_id text unique not null, -- sipgate session ID
  caller_number text,
  status text check (status in ('initiated', 'active', 'completed', 'failed')) default 'initiated',
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_seconds integer,
  metadata jsonb default '{}'::jsonb
);

-- Call Transcripts
create table call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid references call_sessions(id) on delete cascade not null,
  speaker text check (speaker in ('user', 'assistant')) not null,
  text text not null,
  timestamp timestamptz default now(),
  confidence float,
  metadata jsonb default '{}'::jsonb
);

-- Call Recordings
create table call_recordings (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid references call_sessions(id) on delete cascade not null,
  storage_path text not null,
  duration_seconds integer,
  file_size_bytes bigint,
  format text default 'wav',
  created_at timestamptz default now()
);

-- Extracted Variables (from conversations)
create table extracted_variables (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid references call_sessions(id) on delete cascade not null,
  variable_name text not null,
  variable_value text,
  extracted_at timestamptz default now(),
  confidence float
);

-- =====================================================
-- KNOWLEDGE BASE
-- =====================================================

-- Knowledge Bases
create table knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  description text,
  embedding_model text default 'text-embedding-3-small',
  chunk_size integer default 1000,
  chunk_overlap integer default 200,
  created_by uuid references user_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add FK constraint for assistants.knowledge_base_id
alter table assistants
  add constraint fk_assistants_knowledge_base
  foreign key (knowledge_base_id) references knowledge_bases(id);

-- Knowledge Base Documents
create table kb_documents (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid references knowledge_bases(id) on delete cascade not null,
  title text not null,
  content text,
  file_path text,
  file_type text,
  file_size_bytes bigint,
  processing_status text check (processing_status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
  uploaded_by uuid references user_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Knowledge Base Chunks (with embeddings)
create table kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references kb_documents(id) on delete cascade not null,
  knowledge_base_id uuid references knowledge_bases(id) on delete cascade not null,
  content text not null,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  chunk_index integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Create index for vector similarity search (using ivfflat for now, can switch to hnsw)
create index on kb_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- =====================================================
-- INTEGRATIONS
-- =====================================================

-- Webhooks
create table webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  url text not null,
  event_types text[] not null, -- ['call_started', 'call_ended', 'variable_extracted']
  headers jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_by uuid references user_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Webhook Logs
create table webhook_logs (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid references webhooks(id) on delete cascade not null,
  event_type text not null,
  payload jsonb not null,
  response_status integer,
  response_body text,
  attempted_at timestamptz default now()
);

-- =====================================================
-- ANALYTICS
-- =====================================================

-- Call Analytics (Aggregated Daily Metrics)
create table call_analytics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  assistant_id uuid references assistants(id),
  date date not null,
  total_calls integer default 0,
  successful_calls integer default 0,
  failed_calls integer default 0,
  total_duration_seconds integer default 0,
  avg_duration_seconds float,
  avg_user_satisfaction float,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, assistant_id, date)
);

-- LLM Usage Tracking
create table llm_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  call_session_id uuid references call_sessions(id),
  provider text not null,
  model text not null,
  prompt_tokens integer default 0,
  completion_tokens integer default 0,
  total_tokens integer default 0,
  cost_usd decimal(10, 6),
  created_at timestamptz default now()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
alter table organizations enable row level security;
alter table user_profiles enable row level security;
alter table organization_members enable row level security;
alter table call_flows enable row level security;
alter table call_flow_versions enable row level security;
alter table assistants enable row level security;
alter table phone_numbers enable row level security;
alter table call_sessions enable row level security;
alter table call_transcripts enable row level security;
alter table call_recordings enable row level security;
alter table extracted_variables enable row level security;
alter table knowledge_bases enable row level security;
alter table kb_documents enable row level security;
alter table kb_chunks enable row level security;
alter table webhooks enable row level security;
alter table webhook_logs enable row level security;
alter table call_analytics enable row level security;
alter table llm_usage enable row level security;

-- Organizations: Users can only see organizations they're members of
create policy "Users can view their organizations" on organizations
  for select
  using (
    id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

create policy "Users can update organizations they own/admin" on organizations
  for update
  using (
    id in (
      select organization_id from organization_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

create policy "Users can insert organizations" on organizations
  for insert
  with check (true); -- Anyone can create an organization

-- User Profiles: Users can view all profiles, but only update their own
create policy "Anyone can view user profiles" on user_profiles
  for select
  using (true);

create policy "Users can update their own profile" on user_profiles
  for update
  using ((select auth.uid()) = id);

create policy "Users can insert their own profile" on user_profiles
  for insert
  with check ((select auth.uid()) = id);

-- Organization Members: View members of organizations you belong to
create policy "View organization members" on organization_members
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

create policy "Admins can manage organization members" on organization_members
  for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

-- Call Flows: Organization members can view, admins can manage
create policy "Organization members can view flows" on call_flows
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

create policy "Organization members can manage flows" on call_flows
  for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin', 'member')
    )
  );

-- Call Flow Versions: Same as call_flows
create policy "Organization members can view flow versions" on call_flow_versions
  for select
  using (
    flow_id in (
      select id from call_flows
      where organization_id in (
        select organization_id from organization_members
        where user_id = (select auth.uid())
      )
    )
  );

-- Assistants: Organization members can view, admins/members can manage
create policy "Organization members can view assistants" on assistants
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

create policy "Organization members can manage assistants" on assistants
  for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin', 'member')
    )
  );

-- Phone Numbers: Organization members can view, admins can manage
create policy "Organization members can view phone numbers" on phone_numbers
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

create policy "Organization admins can manage phone numbers" on phone_numbers
  for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

-- Call Sessions: Organization members can view
create policy "Organization members can view call sessions" on call_sessions
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

-- Call Transcripts: Organization members can view
create policy "Organization members can view transcripts" on call_transcripts
  for select
  using (
    call_session_id in (
      select id from call_sessions
      where organization_id in (
        select organization_id from organization_members
        where user_id = (select auth.uid())
      )
    )
  );

-- Call Recordings: Organization members can view
create policy "Organization members can view recordings" on call_recordings
  for select
  using (
    call_session_id in (
      select id from call_sessions
      where organization_id in (
        select organization_id from organization_members
        where user_id = (select auth.uid())
      )
    )
  );

-- Extracted Variables: Organization members can view
create policy "Organization members can view extracted variables" on extracted_variables
  for select
  using (
    call_session_id in (
      select id from call_sessions
      where organization_id in (
        select organization_id from organization_members
        where user_id = (select auth.uid())
      )
    )
  );

-- Knowledge Bases: Organization members can view and manage
create policy "Organization members can view knowledge bases" on knowledge_bases
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

create policy "Organization members can manage knowledge bases" on knowledge_bases
  for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin', 'member')
    )
  );

-- KB Documents: Organization members can view and manage
create policy "Organization members can view kb documents" on kb_documents
  for select
  using (
    knowledge_base_id in (
      select id from knowledge_bases
      where organization_id in (
        select organization_id from organization_members
        where user_id = (select auth.uid())
      )
    )
  );

create policy "Organization members can manage kb documents" on kb_documents
  for all
  using (
    knowledge_base_id in (
      select id from knowledge_bases
      where organization_id in (
        select organization_id from organization_members
        where user_id = (select auth.uid()) and role in ('owner', 'admin', 'member')
      )
    )
  );

-- KB Chunks: Organization members can view (for semantic search)
create policy "Organization members can view kb chunks" on kb_chunks
  for select
  using (
    knowledge_base_id in (
      select id from knowledge_bases
      where organization_id in (
        select organization_id from organization_members
        where user_id = (select auth.uid())
      )
    )
  );

-- Webhooks: Organization members can view, admins can manage
create policy "Organization members can view webhooks" on webhooks
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

create policy "Organization admins can manage webhooks" on webhooks
  for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

-- Webhook Logs: Organization members can view
create policy "Organization members can view webhook logs" on webhook_logs
  for select
  using (
    webhook_id in (
      select id from webhooks
      where organization_id in (
        select organization_id from organization_members
        where user_id = (select auth.uid())
      )
    )
  );

-- Call Analytics: Organization members can view
create policy "Organization members can view analytics" on call_analytics
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

-- LLM Usage: Organization members can view
create policy "Organization members can view llm usage" on llm_usage
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Organization members lookup
create index idx_organization_members_user_id on organization_members(user_id);
create index idx_organization_members_org_id on organization_members(organization_id);

-- Call sessions lookups
create index idx_call_sessions_org_id on call_sessions(organization_id);
create index idx_call_sessions_assistant_id on call_sessions(assistant_id);
create index idx_call_sessions_status on call_sessions(status);
create index idx_call_sessions_started_at on call_sessions(started_at desc);

-- Call transcripts lookup
create index idx_call_transcripts_session_id on call_transcripts(call_session_id);

-- Knowledge base chunks lookup
create index idx_kb_chunks_kb_id on kb_chunks(knowledge_base_id);
create index idx_kb_chunks_document_id on kb_chunks(document_id);

-- Analytics lookup
create index idx_call_analytics_org_date on call_analytics(organization_id, date desc);

-- LLM usage lookup
create index idx_llm_usage_org_id on llm_usage(organization_id);
create index idx_llm_usage_created_at on llm_usage(created_at desc);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Vector Similarity Search Function
create or replace function match_kb_chunks(
  query_embedding vector(1536),
  kb_id uuid,
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  similarity float,
  chunk_index integer,
  metadata jsonb
)
language plpgsql
as $$
begin
  return query
  select
    kb_chunks.id,
    kb_chunks.content,
    1 - (kb_chunks.embedding <=> query_embedding) as similarity,
    kb_chunks.chunk_index,
    kb_chunks.metadata
  from kb_chunks
  where kb_chunks.knowledge_base_id = kb_id
    and 1 - (kb_chunks.embedding <=> query_embedding) > match_threshold
  order by kb_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated_at triggers for tables with updated_at column
create trigger update_organizations_updated_at before update on organizations
  for each row execute function update_updated_at_column();

create trigger update_user_profiles_updated_at before update on user_profiles
  for each row execute function update_updated_at_column();

create trigger update_call_flows_updated_at before update on call_flows
  for each row execute function update_updated_at_column();

create trigger update_assistants_updated_at before update on assistants
  for each row execute function update_updated_at_column();

create trigger update_phone_numbers_updated_at before update on phone_numbers
  for each row execute function update_updated_at_column();

create trigger update_knowledge_bases_updated_at before update on knowledge_bases
  for each row execute function update_updated_at_column();

create trigger update_kb_documents_updated_at before update on kb_documents
  for each row execute function update_updated_at_column();

create trigger update_webhooks_updated_at before update on webhooks
  for each row execute function update_updated_at_column();

create trigger update_call_analytics_updated_at before update on call_analytics
  for each row execute function update_updated_at_column();
