-- Drop the problematic policies
drop policy if exists "Users can view their own memberships" on organization_members;
drop policy if exists "View other members in same organization" on organization_members;

-- Simplified policy: users can only view their own membership records
-- For viewing other members, we'll handle authorization in application code
create policy "View own memberships" on organization_members
  for select
  using (user_id = (select auth.uid()));
