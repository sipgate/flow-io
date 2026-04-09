-- Add new Hamburg phone numbers: 040-57309899-0 to 040-57309899-9
-- E.164 format: +4940573098990 to +4940573098999

insert into phone_numbers (organization_id, phone_number, is_active)
select
  (select id from organizations order by created_at limit 1),
  '+494057309899' || generate_series::text,
  true
from generate_series(0, 9)
on conflict (phone_number) do nothing;
