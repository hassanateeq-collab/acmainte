-- Two-phase repair. A repair is first *started* (the AC goes "Under repair"),
-- then later *completed* — at which point the bill, the issue, and the item
-- replaced are captured and the Repair job is logged. Run once on the
-- maintenance-portal database (hgnxpvykqcvnqlhjhhgy).

alter table public.assets
  add column if not exists under_repair boolean not null default false;

alter table public.assets
  add column if not exists repair_started_at timestamptz;

-- Optional note jotted when the repair is started (what looks wrong).
alter table public.assets
  add column if not exists repair_note text;
