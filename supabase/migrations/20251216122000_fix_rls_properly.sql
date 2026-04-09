-- Drop ALL existing policies on organization_members
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where tablename = 'organization_members' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on organization_members', pol.policyname);
  end loop;
end$$;

-- Simple policy: users can only view and manage their own membership records
-- All other operations (viewing other members, inviting, etc.) will use service role
create policy "Users manage own memberships" on organization_members
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
