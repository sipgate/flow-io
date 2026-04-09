-- Add domain field to organizations
alter table organizations
  add column domain text,
  add column auto_add_domain_members boolean default false;

-- Add a unique constraint on domain (nullable unique)
create unique index organizations_domain_key
  on organizations (domain)
  where domain is not null;

-- Add comment
comment on column organizations.domain is 'Email domain for auto-adding members (e.g., "acme.com")';
comment on column organizations.auto_add_domain_members is 'Automatically add users with matching email domain to this organization';
