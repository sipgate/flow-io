-- Drop the existing restrictive policy
drop policy if exists "View organization members" on organization_members;

-- Create a new policy that allows users to see their own memberships
create policy "Users can view their own memberships" on organization_members
  for select
  using (user_id = (select auth.uid()));

-- Create a separate policy for viewing other members in the same organization
create policy "View other members in same organization" on organization_members
  for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid())
    )
  );
