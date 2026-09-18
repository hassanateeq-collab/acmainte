-- Two service cadences:
--   General service — every 3 months  (general_interval_days, default 90)
--   Master service  — every 1 year    (service_interval_days,  default 365)
-- Run once on the maintenance-portal database (SQL editor). Safe to re-run.

alter table public.assets
  add column if not exists last_general_service_date date,
  add column if not exists general_interval_days int not null default 90;

-- Make the existing interval column default to the yearly Master cadence.
alter table public.assets
  alter column service_interval_days set default 365;

-- Which cadence a Service job completed ('General' | 'Master').
alter table public.jobs
  add column if not exists service_kind text;

-- OPTIONAL: normalise existing assets to the standard cadences
-- (General 3-monthly, Master yearly). Run only if you want to reset them all.
-- update public.assets set general_interval_days = 90, service_interval_days = 365;
