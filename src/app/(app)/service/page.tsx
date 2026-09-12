import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listAssets, listAllJobs } from "@/lib/data";
import { daysToService, nextServiceDate, assetStatus } from "@/lib/status";
import { fmtDate } from "@/lib/format";
import { mockOccupancy } from "@/lib/rows";
import PageHeader from "@/components/PageHeader";
import PickupInline from "@/components/PickupInline";
import QuickComplete from "@/components/QuickComplete";
import { StatusBadge, Tag } from "@/components/StatusBadge";
import type { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Work progress from the repair company's point of view. */
function progressOf(a: Asset): { done: boolean; label: string; note?: string } {
  if (a.at_vendor) return { done: false, label: "Pending", note: "with CoolTech" };
  if (a.open_issue) return { done: false, label: "Pending", note: "issue reported" };
  const dts = daysToService(a);
  if (dts !== null && dts <= 14) return { done: false, label: "Pending", note: "service due" };
  return { done: true, label: "Service done" };
}

export default async function ServicePage() {
  const profile = await requireProfile();
  const [assets, jobs] = await Promise.all([listAssets(), listAllJobs()]);
  const isVendor = profile.role === "repair" || profile.role === "admin";

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
            <th>Unit</th><th>Branch / room</th><th>Status</th><th>Progress</th><th>Next service</th><th>Repairs</th><th>Last problem</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>{empty}</td></tr>
          )}
          {rows.map(({ a, d }) => {
            const m = meta.get(a.id);
            const nsd = nextServiceDate(a);
            const prog = progressOf(a);
            return (
              <tr key={a.id}>
                <td><Link href={`/assets/${a.id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{a.id}</Link></td>
                <td>{a.current_branch}{a.room && a.room.toLowerCase() !== "store" ? ` · Room ${a.room} (${mockOccupancy(a.room)})` : " · Store"}</td>
                <td><StatusBadge status={assetStatus(a)} /></td>
                <td>
                  <Tag tone={prog.done ? "brand" : "amber"}>
                    {prog.done ? "✓ " : "● "}{prog.label}
                  </Tag>
                  {prog.note && (
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{prog.note}</div>
                  )}
                </td>
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
                    {/* Only the repair company (or admin) completes a service. */}
                    {isVendor && !prog.done && (
                      <QuickComplete assetId={a.id} kind="Service" label="✓ Mark serviced" />
                    )}
                    <Link href={`/assets/${a.id}`} className="btn btn-sm">Details / bill</Link>
                    {canPickup && !a.at_vendor && <PickupInline assetId={a.id} />}
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
        subtitle={
          isVendor
            ? "Units approaching their next service, soonest first. Mark a service done, or pick a unit up for the workshop."
            : "Units approaching their next service, soonest first. Progress is updated by CoolTech."
        }
      />
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Due within 30 days</h2>
      {renderTable(soon, "Nothing due in the next 30 days.")}
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Later</h2>
      {renderTable(later, "Nothing scheduled further out.")}
    </div>
  );
}
