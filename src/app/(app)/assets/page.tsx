import { requireProfile } from "@/lib/auth";
import { listAssets, listAllJobs, listBranches, jobTotal } from "@/lib/data";
import { assetStatus, nextServiceDate, lifeLeftYears } from "@/lib/status";
import { buildAssetRows, mockOccupancy } from "@/lib/rows";
import PageHeader from "@/components/PageHeader";
import AddAssetForm from "@/components/forms/AddAssetForm";
import AssetsTable, { type ClientRow } from "@/components/AssetsTable";
import type { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const profile = await requireProfile();
  const [assets, jobs, branches] = await Promise.all([
    listAssets(),
    listAllJobs(),
    listBranches(),
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
        }
      : null;

  const clientRows: ClientRow[] = rows.map((r) => {
    const primary = r.interior ?? r.exterior!;
    const nsd = nextServiceDate(primary);
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
      occupancy: mockOccupancy(r.room),
      interior: unit(r.interior),
      exterior: unit(r.exterior),
      swapped: r.swapped,
      nextService: nsd ? nsd.toISOString() : null,
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
          showAdd ? <AddAssetForm branches={branches} profile={profile} /> : undefined
        }
      />
      <AssetsTable
        rows={clientRows}
        branches={branches.map((b) => ({ code: b.code, name: b.name }))}
        showBranchTabs={profile.role !== "branch_manager"}
      />
    </div>
  );
}
