-- FIR auto-resolution. When the FIR portal marks an AC issue as done, this
-- portal auto-logs a Repair for the matched AC(s) and clears the open issue.
-- Such a repair was never logged by hand, so it carries no manual service
-- date: `from_fir` flags it and the UI shows its date as "—".
-- Run once on the maintenance-portal database (hgnxpvykqcvnqlhjhhgy).

alter table public.jobs
  add column if not exists from_fir boolean not null default false;

-- Marks a FIR issue's resolution as already handled, so repeated "completed"
-- webhook fires don't log the repair twice.
alter table public.fir_links
  add column if not exists resolved_at timestamptz;
