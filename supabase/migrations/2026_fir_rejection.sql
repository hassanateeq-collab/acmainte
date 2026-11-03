-- FIR rejection. When the FIR portal rejects an AC issue, we mark its link
-- rejected so it drops out of the History list and the AC's open-issue flag is
-- cleared. Run once on the maintenance-portal database.

alter table public.fir_links
  add column if not exists rejected_at timestamptz;
