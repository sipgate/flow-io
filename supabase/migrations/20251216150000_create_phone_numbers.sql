-- Create phone_numbers table for sipgate phone number management
create table phone_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  phone_number text not null unique,
  assistant_id uuid references assistants(id) on delete set null,
  is_active boolean not null default true,
  assigned_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for performance
create index idx_phone_numbers_organization on phone_numbers(organization_id);
create index idx_phone_numbers_assistant on phone_numbers(assistant_id);
create unique index idx_phone_numbers_number on phone_numbers(phone_number);

-- Enable Row Level Security
alter table phone_numbers enable row level security;

-- Policy: Users can view phone numbers in their organizations
create policy "Users can view phone numbers in their org"
  on phone_numbers for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Policy: Admins and owners can manage phone numbers
create policy "Admins can manage phone numbers"
  on phone_numbers for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Trigger function to free phone number when assistant is deleted
create or replace function free_phone_number_on_assistant_delete()
returns trigger as $$
begin
  update phone_numbers
  set assistant_id = null, assigned_at = null
  where assistant_id = old.id;
  return old;
end;
$$ language plpgsql;

-- Create trigger
create trigger free_phone_number_on_assistant_delete
  before delete on assistants
  for each row
  execute function free_phone_number_on_assistant_delete();
