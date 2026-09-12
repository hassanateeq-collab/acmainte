-- =============================================================================
-- Hamsun Assets — Asset & Maintenance Portal
-- Full database schema. Paste this whole file into the Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run) for your project.
-- It is idempotent: safe to run more than once.
-- =============================================================================

create extension if not exists pgcrypto;

-- --- Enums -------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin','branch_manager','repair');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_type as enum ('Service','Repair','Charge');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transfer_status as enum ('waiting','accepted','declined');
exception when duplicate_object then null; end $$;

-- --- Branches ----------------------------------------------------------------
create table if not exists public.branches (
  code text primary key,
  name text not null,
  sort int not null default 0
);

insert into public.branches (code, name, sort) values
  ('FSL','Shahrah-e-Faisal',1),
  ('EXT','Extension',2),
  ('CLF','Clifton',3),
  ('DHA','DHA',4)
on conflict (code) do update set name = excluded.name, sort = excluded.sort;

-- --- Profiles (one row per auth user) ----------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role user_role not null default 'branch_manager',
  branch_code text references public.branches(code),
  created_at timestamptz not null default now()
);

-- --- Assets ------------------------------------------------------------------
create table if not exists public.assets (
  id text primary key,                              -- e.g. AC-FSL-I-001
  type text not null default 'AC',
  part text check (part in ('I','E')),              -- null for non-AC types
  home_branch text not null references public.branches(code),
  current_branch text not null references public.branches(code),
  room text,                                        -- 'store' = spare, not installed
  seq int not null,
  installed_date date,
  expected_life_years int not null default 10,
  last_service_date date,
  service_interval_days int not null default 90,
  open_issue text,
  at_vendor boolean not null default false,
  paired_with text references public.assets(id),    -- the connected opposite part
  created_at timestamptz not null default now()
);
create index if not exists assets_seq_idx on public.assets(type, home_branch, part, seq);
create index if not exists assets_current_branch_idx on public.assets(current_branch);
create index if not exists assets_paired_idx on public.assets(paired_with);

-- --- Transfers ---------------------------------------------------------------
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.assets(id),
  from_branch text not null references public.branches(code),
  to_branch text not null references public.branches(code),
  reason text,
  status transfer_status not null default 'waiting',
  requested_by uuid references public.profiles(id),
  requested_by_name text,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_by_name text,
  decided_at timestamptz
);
create index if not exists transfers_status_idx on public.transfers(status);
create index if not exists transfers_asset_idx on public.transfers(asset_id);

-- --- Jobs (service / repair / standalone charge) -----------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.assets(id),
  date date not null default current_date,
  type job_type not null,
  problem text,
  work_done text,
  bill_amount numeric(12,2) not null default 0,
  days_taken int not null default 0,
  created_by uuid references public.profiles(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index if not exists jobs_asset_idx on public.jobs(asset_id);

-- --- Additional charges attached to a job ------------------------------------
create table if not exists public.job_charges (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  label text not null,
  amount numeric(12,2) not null default 0,
  date date not null default current_date,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists job_charges_job_idx on public.job_charges(job_id);

-- --- Job change log (edits / deletes need a reason) --------------------------
create table if not exists public.job_edits (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  summary text not null,
  reason text not null,
  edited_by_name text,
  created_at timestamptz not null default now()
);

-- --- Asset timeline (non-money events) ---------------------------------------
create table if not exists public.asset_events (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.assets(id),
  kind text not null,                               -- installed|moved|pairing|issue|pickup|return|note
  description text not null,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists asset_events_asset_idx on public.asset_events(asset_id, created_at desc);

-- --- Notifications (one row per audience inbox) ------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null,                           -- 'admin' | 'repair' | 'branch:FSL'
  message text not null,
  kind text,
  asset_id text,
  transfer_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_audience_idx on public.notifications(audience, created_at desc);

-- --- Auto-create a profile when an auth user is created ----------------------
-- The FIRST user created becomes admin (turnkey bootstrap). After that the
-- role/branch come from the user's metadata, defaulting to branch_manager.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
  meta_role text;
  meta_branch text;
  meta_name text;
begin
  select count(*) = 0 into is_first from public.profiles;
  meta_role := new.raw_user_meta_data->>'role';
  meta_branch := new.raw_user_meta_data->>'branch_code';
  meta_name := coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1));

  insert into public.profiles (id, email, full_name, role, branch_code)
  values (
    new.id,
    new.email,
    meta_name,
    case
      when is_first then 'admin'::user_role
      when meta_role in ('admin','branch_manager','repair') then meta_role::user_role
      else 'branch_manager'::user_role
    end,
    nullif(meta_branch,'')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: if you already created users before running this, give them profiles.
insert into public.profiles (id, email, full_name, role)
select u.id, u.email, split_part(u.email,'@',1),
       case when not exists (select 1 from public.profiles) then 'admin'::user_role
            else 'branch_manager'::user_role end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- --- Row Level Security ------------------------------------------------------
-- All application data access goes through the server using the service role
-- key (which bypasses RLS). We lock every table to the anon/authenticated
-- roles so the browser can never read data directly with the publishable key.
alter table public.branches       enable row level security;
alter table public.profiles       enable row level security;
alter table public.assets         enable row level security;
alter table public.transfers      enable row level security;
alter table public.jobs           enable row level security;
alter table public.job_charges    enable row level security;
alter table public.job_edits      enable row level security;
alter table public.asset_events   enable row level security;
alter table public.notifications  enable row level security;

-- (No permissive policies are created on purpose: anon/authenticated get no
--  access; the service role bypasses RLS. This keeps the publishable key safe
--  to ship in the browser while the server enforces authorization.)

-- =============================================================================
-- Done. Next: create your first login user in
-- Dashboard -> Authentication -> Users -> Add user (email + password,
-- tick "Auto Confirm User"). That first user becomes Admin automatically.
-- =============================================================================
