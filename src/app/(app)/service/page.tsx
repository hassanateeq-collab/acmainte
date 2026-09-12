import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listAssets, listAllJobs } from "@/lib/data";
import { daysToService, nextServiceDate, assetStatus } from "@/lib/status";
import { fmtDate } from "@/lib/format";
import { mockOccupancy } from "@/lib/rows";
import PageHeader from "@/components/PageHeader";
import PickupInline from "@/components/PickupInline";
import QuickComplete from "@/components/QuickComplete";
import { StatusBadge } from "@/components/StatusBadge";
import type { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ServicePage() {
  const profile = await requireProfile();
  const [assets, jobs] = await Promise.all([listAssets(), listAllJobs()]);

  const inScope =
    profile.role === "branch_manager"
      ? assets.filter((a) => a.current_branch === profile.branch_code)
      : assets;

  // repairs count + last problem per asset
  const meta = new Map<string, { repairs: number; lastProblem: string | null }>();
  for (const j of jobs) {
    const m = meta.get(j.asset_id) ?? { repairs: 0, lastProblem: null };
    if (j.type === "Repair") m.repairs += 1;
    if (j.problem && !m.lastProblem) m.lastProblem = j.problem; // jobs already desc by date
    meta.set(j.asset_id, m);
  }

  const withDays = inScope
    .filter((a) => !a.at_vendor)
    .map((a) => ({ a, d: daysToService(a) }))
    .filter((x) => x.d !== null)
    .sort((x, y) => (x.d! - y.d!));

  const soon = withDays.filter((x) => x.d! <= 30);
  const later = withDays.filter((x) => x.d! > 30);
  const canPickup = profile.role === "repair" || profile.role === "admin";

  const renderTable = (rows: { a: Asset; d: number | null }[], empty: string) => (
    <div className="card table-wrap" style={{ marginBottom: 24 }}>
      <table className="data">
        <thead>
          <tr>
            <th>Unit</th><th>Branch / room</th><th>Status</th><th>Next service</th><th>Repairs</th><th>Last problem</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>{empty}</td></tr>
          )}
          {rows.map(({ a, d }) => {
            const m = meta.get(a.id);
            const nsd = nextServiceDate(a);
            return (
              <tr key={a.id}>
                <td><Link href={`/assets/${a.id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{a.id}</Link></td>
                <td>{a.current_branch}{a.room && a.room.toLowerCase() !== "store" ? ` · Room ${a.room} (${mockOccupancy(a.room)})` : " · Store"}</td>
                <td><StatusBadge status={assetStatus(a)} /></td>
                <td>
                  {fmtDate(nsd ? nsd.toISOString() : null)}
                  <div style={{ fontSize: 12, color: d! < 0 ? "#b91c1c" : "var(--muted)" }}>
                    {d! < 0 ? `Overdue ${Math.abs(d!)}d` : `in ${d}d`}
                  </div>
                </td>
                <td>{m?.repairs ?? 0}</td>
                <td style={{ maxWidth: 220, color: "var(--muted)", fontSize: 13 }}>{m?.lastProblem ?? "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <QuickComplete assetId={a.id} kind="Service" label="✓ Serviced" />
                    <Link href={`/assets/${a.id}`} className="btn btn-sm">Details / bill</Link>
                    {canPickup && <PickupInline assetId={a.id} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={profile.role === "repair" ? "Service due" : "Service & repairs"}
        subtitle="Units approaching their next service, soonest first. Log a service, or pick a unit up for the workshop."
      />
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Due within 30 days</h2>
      {renderTable(soon, "Nothing due in the next 30 days.")}
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Later</h2>
      {renderTable(later, "Nothing scheduled further out.")}
    </div>
  );
}
