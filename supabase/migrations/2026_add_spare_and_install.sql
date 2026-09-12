-- Spare labelling + move-to-install workflow.
-- Run this once on the maintenance-portal database (SQL editor).

-- 1) Branch managers can label an asset as a spare (movable to another branch).
alter table public.assets
  add column if not exists is_spare boolean not null default false;

-- 2) A move request now carries the destination room, and CoolTech confirms
--    installation after the part physically arrives.
alter table public.transfers
  add column if not exists to_room text,
  add column if not exists installed boolean not null default false,
  add column if not exists installed_by uuid references public.profiles(id),
  add column if not exists installed_by_name text,
  add column if not exists installed_at timestamptz;
