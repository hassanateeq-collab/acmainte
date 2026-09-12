import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listTransfers } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import DecideTransfer from "@/components/DecideTransfer";
import { Tag } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const profile = await requireProfile();
  if (profile.role === "repair") {
    return (
      <div>
        <PageHeader title="Transfers" />
        <p style={{ color: "var(--muted)" }}>The repair company does not handle transfers.</p>
      </div>
    );
  }

  const transfers = await listTransfers();
  const waiting = transfers.filter((t) => t.status === "waiting");
  const completed = transfers.filter((t) => t.status !== "waiting");

  const canDecide = (fromBranch: string) =>
    profile.role === "admin" ||
    (profile.role === "branch_manager" && profile.branch_code === fromBranch);

  return (
    <div>
      <PageHeader
        title="Transfers"
        subtitle="Parts move only when the owning branch accepts. Request a transfer from any asset's record."
      />

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Waiting for a decision</h2>
      <div className="card table-wrap" style={{ marginBottom: 24 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Part</th><th>From → To</th><th>Reason</th><th>Requested by</th><th>When</th><th></th>
            </tr>
          </thead>
          <tbody>
            {waiting.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>Nothing waiting.</td></tr>
            )}
            {waiting.map((t) => (
              <tr key={t.id}>
                <td><Link href={`/assets/${t.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{t.asset_id}</Link></td>
                <td>{t.from_branch} → {t.to_branch}</td>
                <td style={{ maxWidth: 260 }}>{t.reason}</td>
                <td>{t.requested_by_name}</td>
                <td>{fmtDateTime(t.requested_at)}</td>
                <td>{canDecide(t.from_branch) ? <DecideTransfer transferId={t.id} /> : <span style={{ color: "var(--muted)", fontSize: 12 }}>Awaiting {t.from_branch}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Completed</h2>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Part</th><th>From → To</th><th>Outcome</th><th>Decided by</th><th>When</th>
            </tr>
          </thead>
          <tbody>
            {completed.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No completed transfers.</td></tr>
            )}
            {completed.map((t) => (
              <tr key={t.id}>
                <td><Link href={`/assets/${t.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{t.asset_id}</Link></td>
                <td>{t.from_branch} → {t.to_branch}</td>
                <td>{t.status === "accepted" ? <Tag tone="brand">Accepted</Tag> : <Tag>Declined</Tag>}</td>
                <td>{t.decided_by_name ?? "—"}</td>
                <td>{fmtDateTime(t.decided_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
