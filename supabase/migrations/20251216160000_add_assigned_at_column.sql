-- Add missing assigned_at column to phone_numbers table
alter table phone_numbers
add column if not exists assigned_at timestamp with time zone;
