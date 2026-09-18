-- Two service cadences: General (monthly) and Normal (quarterly).
-- Run once on the maintenance-portal database (SQL editor). Safe to re-run.

-- Existing service_interval_days / last_service_date are the NORMAL (quarterly) cycle.
alter table public.assets
  add column if not exists last_general_service_date date,
  add column if not exists general_interval_days int not null default 30;

-- Which cadence a Service job completed.
alter table public.jobs
  add column if not exists service_kind text;
