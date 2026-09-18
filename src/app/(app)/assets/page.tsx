import { requireProfile } from "@/lib/auth";
import { listAssets, listAllJobs, listBranches, listAssetTypes, jobTotal } from "@/lib/data";
import {
  assetStatus,
  lifeLeftYears,
  generalServiceDate,
  masterServiceDate,
  generalDays,
  masterDays,
} from "@/lib/status";
import { buildAssetRows } from "@/lib/rows";
import { getAllOccupancy, roomState, occText } from "@/lib/pms";
import PageHeader from "@/components/PageHeader";
import AddAssetForm from "@/components/forms/AddAssetForm";
import ManageTypes from "@/components/ManageTypes";
import AssetsTable, { type ClientRow } from "@/components/AssetsTable";
import type { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const profile = await requireProfile();
  const [assets, jobs, branches, types, occ] = await Promise.all([
    listAssets(),
    listAllJobs(),
    listBranches(),
    listAssetTypes(),
    getAllOccupancy(),
  ]);

  // Aggregate money + repair counts per asset.
  const agg = new Map<string, { repairs: number; total: number }>();
  for (const j of jobs) {
    const cur = agg.get(j.asset_id) ?? { repairs: 0, total: 0 };
    if (j.type === "Repair") cur.repairs += 1;
    cur.total += jobTotal(j);
    agg.set(j.asset_id, cur);
  }

  const rows = buildAssetRows(assets);

  const unit = (a: Asset | null) =>
    a
      ? {
          id: a.id,
          status: assetStatus(a),
          swappedHome: a.home_branch,
          room: a.room,
          installed_date: a.installed_date,
          last_service_date: a.last_service_date,
          last_general_service_date: a.last_general_service_date,
          expected_life_years: a.expected_life_years,
          service_interval_days: a.service_interval_days,
          general_interval_days: a.general_interval_days,
        }
      : null;

  const clientRows: ClientRow[] = rows.map((r) => {
    const primary = r.interior ?? r.exterior!;
    const gsd = generalServiceDate(primary);
    const msd = masterServiceDate(primary);
    const combinedRepairs =
      (r.interior ? agg.get(r.interior.id)?.repairs ?? 0 : 0) +
      (r.exterior ? agg.get(r.exterior.id)?.repairs ?? 0 : 0);
    const combinedTotal =
      (r.interior ? agg.get(r.interior.id)?.total ?? 0 : 0) +
      (r.exterior ? agg.get(r.exterior.id)?.total ?? 0 : 0);
    return {
      key: r.key,
      branch: r.branch,
      room: r.room,
      occupancy: occText(roomState(occ, r.branch, r.room)),
      interior: unit(r.interior),
      exterior: unit(r.exterior),
      swapped: r.swapped,
      generalService: gsd ? gsd.toISOString() : null,
      generalDays: generalDays(primary),
      masterService: msd ? msd.toISOString() : null,
      masterDays: masterDays(primary),
      lifeLeft: lifeLeftYears(primary),
      repairs: combinedRepairs,
      total: combinedTotal,
    };
  });

  const showAdd = profile.role !== "repair";

  return (
    <div>
      <PageHeader
        title={profile.role === "repair" ? "All ACs" : "Assets"}
        subtitle="One row per AC set — interior with its connected exterior. Click any unit to open its record."
        actions={
          showAdd ? (
            <>
              {profile.role === "admin" && <ManageTypes types={types} />}
              <AddAssetForm branches={branches} profile={profile} types={types} />
            </>
          ) : undefined
        }
      />
      <AssetsTable
        rows={clientRows}
        branches={branches.map((b) => ({ code: b.code, name: b.name }))}
        showBranchTabs={profile.role !== "branch_manager"}
        viewer={{ role: profile.role, branch: profile.branch_code }}
      />
    </div>
  );
}
