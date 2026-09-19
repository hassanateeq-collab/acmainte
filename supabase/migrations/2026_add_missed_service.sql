-- Missed-service tracking.
-- A service is "due" for 7 days after its date; once that window passes the
-- clock rolls to the next cycle and a miss is counted. Outstanding misses are
-- derived from the dates on read; these counters persist misses that were
-- already sealed by a later (late) service. Run once on the maintenance DB.

alter table public.assets
  add column if not exists general_missed int not null default 0,
  add column if not exists master_missed  int not null default 0;
