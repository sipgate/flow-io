-- Fix phone_numbers.scenario_id FK: ON DELETE SET NULL conflicts with NOT NULL constraint
-- (introduced in 20260410000000). Phone numbers are org resources and should be detached,
-- not deleted, when a scenario is removed. Make scenario_id nullable again.
ALTER TABLE phone_numbers ALTER COLUMN scenario_id DROP NOT NULL;

ALTER TABLE phone_numbers DROP CONSTRAINT IF EXISTS phone_numbers_scenario_id_fkey;
ALTER TABLE phone_numbers ADD CONSTRAINT phone_numbers_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES call_scenarios(id) ON DELETE SET NULL;
