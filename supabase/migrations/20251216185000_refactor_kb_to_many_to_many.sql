-- Refactor knowledge bases to be global with many-to-many relationship to assistants
-- This allows multiple assistants to share the same KB and one assistant to use multiple KBs

-- Step 1: Create junction table for assistant-knowledge base assignments
create table assistant_knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references assistants(id) on delete cascade,
  knowledge_base_id uuid not null references knowledge_bases(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(assistant_id, knowledge_base_id)
);

create index idx_assistant_kb_assistant on assistant_knowledge_bases(assistant_id);
create index idx_assistant_kb_kb on assistant_knowledge_bases(knowledge_base_id);

-- Step 2: Migrate existing data (if any)
-- Copy existing knowledge_base_id relationships from assistants to junction table
insert into assistant_knowledge_bases (assistant_id, knowledge_base_id)
select id, knowledge_base_id
from assistants
where knowledge_base_id is not null;

-- Step 3: Remove knowledge_base_id from assistants (now using junction table)
alter table assistants drop constraint if exists fk_assistants_knowledge_base;
alter table assistants drop column if exists knowledge_base_id;

-- Step 4: Add tool configuration to assistants
-- This enables LLM to use function calling to access knowledge bases
alter table assistants add column if not exists enable_kb_tool boolean default true;
alter table assistants add column if not exists kb_tool_description text default 'Search the knowledge base for relevant information to answer user questions';

-- Step 5: RLS policies for junction table
alter table assistant_knowledge_bases enable row level security;

create policy "Users can view assistant KB assignments in their org"
  on assistant_knowledge_bases for select
  using (
    assistant_id in (
      select id from assistants
      where organization_id in (
        select organization_id from organization_members
        where user_id = auth.uid()
      )
    )
  );

create policy "Admins can manage assistant KB assignments in their org"
  on assistant_knowledge_bases for all
  using (
    assistant_id in (
      select id from assistants
      where organization_id in (
        select organization_id from organization_members
        where user_id = auth.uid() and role in ('owner', 'admin')
      )
    )
  );

-- Step 6: RLS policies already exist on knowledge_bases (organization-scoped)
-- No changes needed - they were already correct in initial schema
