-- Links FIR-portal AC issues that have been received into this portal, so each
-- is processed exactly once (the FIR webhook can fire on insert and update).
-- Run once on the maintenance-portal database.

create table if not exists public.fir_links (
  fir_issue_id uuid primary key,
  fir_no text,
  branch text,
  room_no text,
  asset_ids text[],
  created_at timestamptz not null default now()
);
