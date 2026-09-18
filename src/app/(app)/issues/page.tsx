import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listAssets } from "@/lib/data";
import { getAllOccupancy, roomState, occText } from "@/lib/pms";
import PageHeader from "@/components/PageHeader";
import PickupInline from "@/components/PickupInline";
import QuickComplete from "@/components/QuickComplete";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const profile = await requireProfile();
  const [assets, occ] = await Promise.all([listAssets(), getAllOccupancy()]);
  const inScope =
    profile.role === "branch_manager"
      ? assets.filter((a) => a.current_branch === profile.branch_code)
      : assets;

  const reported = inScope.filter((a) => a.open_issue && !a.at_vendor);
  const workshop = inScope.filter((a) => a.at_vendor);
  const canPickup = profile.role === "admin" || profile.role === "branch_manager";

  return (
    <div>
      <PageHeader
        title="Issues & pickups"
        subtitle="Reported faults to attend to, and the units currently in the workshop."
      />

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Reported issues</h2>
      <div className="card table-wrap" style={{ marginBottom: 24 }}>
        <table className="data">
          <thead><tr><th>Unit</th><th>Branch / room</th><th>Issue</th><th>Actions</th></tr></thead>
          <tbody>
            {reported.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No open issues.</td></tr>
            )}
            {reported.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/assets/${a.id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{a.id}</Link></td>
                <td>{a.current_branch}{a.room && a.room.toLowerCase() !== "store" ? ` · Room ${a.room} (${occText(roomState(occ, a.current_branch, a.room))})` : " · Store"}</td>
                <td style={{ maxWidth: 320 }}>{a.open_issue}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <QuickComplete assetId={a.id} kind="Repair" label="✓ Repaired" />
                    <Link href={`/assets/${a.id}`} className="btn btn-sm">Details / bill</Link>
                    {canPickup && <PickupInline assetId={a.id} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>In the workshop</h2>
      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Unit</th><th>Branch / room</th><th>Actions</th></tr></thead>
          <tbody>
            {workshop.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No units in the workshop.</td></tr>
            )}
            {workshop.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/assets/${a.id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{a.id}</Link></td>
                <td>{a.current_branch}{a.room && a.room.toLowerCase() !== "store" ? ` · Room ${a.room}` : " · Store"}</td>
                <td><Link href={`/assets/${a.id}`} className="btn btn-sm btn-primary">Return &amp; log bill</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
