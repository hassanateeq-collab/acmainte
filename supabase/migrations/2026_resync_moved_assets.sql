-- One-off repair: sync each asset's current_branch to its most recent accepted
-- move. Needed for assets whose branch update was lost when the transfers were
-- accepted before the is_spare/install columns existed (the combined UPDATE
-- failed silently). Safe to run repeatedly.

update public.assets a
set current_branch = latest.to_branch
from (
  select distinct on (asset_id) asset_id, to_branch
  from public.transfers
  where status = 'accepted'
  order by asset_id, decided_at desc nulls last
) latest
where latest.asset_id = a.id
  and a.current_branch <> latest.to_branch;
