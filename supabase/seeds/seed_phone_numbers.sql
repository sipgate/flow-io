-- Seed script for pre-configured sipgate phone numbers
-- Numbers: 02041-34877-0 and 02041-34877-10 to 02041-34877-99
-- Total: 91 numbers
--
-- In E.164 format:
-- +492041348770 (for 02041-34877-0)
-- +4920413487710 to +4920413487799 (for 02041-34877-10 to 02041-34877-99)

-- First number: 02041-34877-0 → +492041348770
insert into phone_numbers (organization_id, phone_number, is_active)
values (
  (select id from organizations order by created_at limit 1),
  '+492041348770',
  true
);

-- Numbers 10-99: 02041-34877-10 to 02041-34877-99 → +4920413487710 to +4920413487799
insert into phone_numbers (organization_id, phone_number, is_active)
select
  (select id from organizations order by created_at limit 1), -- Assign to first organization
  '+49204134877' || generate_series::text, -- Format: +4920413487710 to +4920413487799
  true
from generate_series(10, 99);
