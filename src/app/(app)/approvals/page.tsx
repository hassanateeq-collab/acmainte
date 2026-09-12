import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listTransfers } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import DecideTransfer from "@/components/DecideTransfer";
import { Tag } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const profile = await requireProfile();
  if (profile.role === "repair") {
    return (
      <div>
        <PageHeader title="Approvals" />
        <p style={{ color: "var(--muted)" }}>The repair company does not approve moves.</p>
      </div>
    );
  }

  const transfers = await listTransfers();
  const myBranch = profile.branch_code;

  // Requests another branch made for a part held by MY branch — I decide these.
  const incoming = transfers.filter(
    (t) =>
      t.status === "waiting" &&
      (profile.role === "admin" || t.from_branch === myBranch)
  );

  // Recently decided (accepted / declined) that I acted on or that concern my branch.
  const recent = transfers
    .filter(
      (t) =>
        t.status !== "waiting" &&
        (profile.role === "admin" ||
          t.from_branch === myBranch ||
          t.to_branch === myBranch)
    )
    .sort((a, b) => ((a.decided_at ?? "") < (b.decided_at ?? "") ? 1 : -1))
    .slice(0, 25);

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle={
          profile.role === "admin"
            ? "Every pending move request across branches. Accept or decline."
            : "Another branch wants a spare your branch holds. Nothing moves until you accept."
        }
      />

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>
        Waiting for your decision
        {incoming.length > 0 && (
          <span style={{ marginLeft: 8 }}><Tag tone="amber">{incoming.length}</Tag></span>
        )}
      </h2>
      <div className="card table-wrap" style={{ marginBottom: 24 }}>
        <table className="data">
          <thead>
            <tr><th>Part</th><th>From → To</th><th>Install room</th><th>Reason</th><th>Requested by</th><th>When</th><th></th></tr>
          </thead>
          <tbody>
            {incoming.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>Nothing waiting for your approval.</td></tr>
            )}
            {incoming.map((t) => (
              <tr key={t.id}>
                <td><Link href={`/assets/${t.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{t.asset_id}</Link></td>
                <td>{t.from_branch} → {t.to_branch}</td>
                <td>{t.to_room ? `Room ${t.to_room}` : "—"}</td>
                <td style={{ maxWidth: 260 }}>{t.reason}</td>
                <td>{t.requested_by_name ?? "—"}</td>
                <td>{fmtDateTime(t.requested_at)}</td>
                <td><DecideTransfer transferId={t.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Recently decided</h2>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Part</th><th>From → To</th><th>Outcome</th><th>Decided by</th><th>When</th></tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No decisions yet.</td></tr>
            )}
            {recent.map((t) => (
              <tr key={t.id}>
                <td><Link href={`/assets/${t.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{t.asset_id}</Link></td>
                <td>{t.from_branch} → {t.to_branch}{t.to_room ? ` (Room ${t.to_room})` : ""}</td>
                <td>
                  {t.status === "accepted" ? (
                    t.installed ? <Tag tone="brand">Moved</Tag> : <Tag tone="amber">Waiting for installation</Tag>
                  ) : (
                    <Tag>Declined</Tag>
                  )}
                </td>
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
