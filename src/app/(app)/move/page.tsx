import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listAssets, listTransfers, listBranches } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import DecideTransfer from "@/components/DecideTransfer";
import RequestMove from "@/components/RequestMove";
import { Tag } from "@/components/StatusBadge";
import type { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";

/** A part is "spare" (movable) when it isn't at the vendor and is either in
 *  the store or not paired to its opposite — i.e. not actively installed. */
function isSpare(a: Asset): boolean {
  if (a.at_vendor) return false;
  const inStore = !a.room || a.room.trim().toLowerCase() === "store";
  return inStore || a.paired_with === null;
}

function partLabel(a: Asset) {
  return a.part === "I" ? "Interior" : a.part === "E" ? "Exterior" : "—";
}
function roomLabel(a: Asset) {
  return a.room && a.room.toLowerCase() !== "store" ? `Room ${a.room}` : "Store";
}

export default async function MovePage() {
  const profile = await requireProfile();
  const [assets, transfers, branches] = await Promise.all([
    listAssets(),
    listTransfers(),
    listBranches(),
  ]);
  const branchName = (code: string) =>
    branches.find((b) => b.code === code)?.name ?? code;

  const isRepair = profile.role === "repair";
  const myBranch = profile.branch_code;

  // Assets that already have an open request — don't offer them again.
  const pendingAssetIds = new Set(
    transfers.filter((t) => t.status === "waiting").map((t) => t.asset_id)
  );

  /* ---------------------------------------------------------------- repair */
  if (isRepair) {
    const moves = transfers
      .slice()
      .sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1));
    return (
      <div>
        <PageHeader
          title="Movement history"
          subtitle="Where every part came from, where it is now, and where it's installed."
        />

        <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Where each part is now</h2>
        <div className="card table-wrap" style={{ marginBottom: 24 }}>
          <table className="data">
            <thead>
              <tr><th>Part</th><th>Type</th><th>Home branch</th><th>Current branch</th><th>Installed</th><th>Paired</th></tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/assets/${a.id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{a.id}</Link></td>
                  <td>{partLabel(a)}</td>
                  <td>{a.home_branch}</td>
                  <td>
                    {a.current_branch}
                    {a.current_branch !== a.home_branch && (
                      <span style={{ marginLeft: 6 }}><Tag tone="amber">moved</Tag></span>
                    )}
                  </td>
                  <td>{a.at_vendor ? "With CoolTech" : roomLabel(a)}</td>
                  <td>{a.paired_with ? a.paired_with : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Move log</h2>
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr><th>Part</th><th>From → To</th><th>Reason</th><th>Outcome</th><th>Requested by</th><th>When</th></tr>
            </thead>
            <tbody>
              {moves.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No moves recorded yet.</td></tr>
              )}
              {moves.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/assets/${t.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{t.asset_id}</Link></td>
                  <td>{t.from_branch} → {t.to_branch}</td>
                  <td style={{ maxWidth: 240, color: "var(--muted)", fontSize: 13 }}>{t.reason}</td>
                  <td>
                    {t.status === "accepted" ? <Tag tone="brand">Accepted</Tag> : t.status === "declined" ? <Tag>Declined</Tag> : <Tag tone="amber">Waiting</Tag>}
                  </td>
                  <td>{t.requested_by_name ?? "—"}</td>
                  <td>{fmtDateTime(t.requested_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------ admin + branch manager */

  // Spare parts I could pull in. Admin sees all branches; a branch manager
  // sees spares that are NOT already in their own branch.
  const spares = assets
    .filter(isSpare)
    .filter((a) => !pendingAssetIds.has(a.id))
    .filter((a) => (profile.role === "branch_manager" ? a.current_branch !== myBranch : true))
    .sort((a, b) => (a.current_branch + a.id).localeCompare(b.current_branch + b.id));

  // Requests I need to decide (someone wants a part from my branch).
  const incoming = transfers.filter(
    (t) =>
      t.status === "waiting" &&
      (profile.role === "admin" || t.from_branch === myBranch)
  );

  // My own pending requests (into my branch).
  const outgoing = transfers.filter(
    (t) =>
      t.status === "waiting" &&
      (profile.role === "admin" ? true : t.to_branch === myBranch) &&
      !(profile.role !== "admin" && t.from_branch === myBranch)
  );

  const history = transfers
    .filter((t) => t.status !== "waiting")
    .sort((a, b) => ((a.decided_at ?? "") < (b.decided_at ?? "") ? 1 : -1));

  const destBranch = profile.role === "admin" ? null : myBranch;

  return (
    <div>
      <PageHeader
        title="Move parts"
        subtitle={
          profile.role === "admin"
            ? "Spare interior/exterior units across branches. Approve or decline any request."
            : "Pull a spare interior or exterior unit from another branch. The owning branch must accept before it moves."
        }
      />

      {/* Requests waiting on me */}
      {incoming.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>
            Requests to approve
            <span style={{ marginLeft: 8 }}><Tag tone="amber">{incoming.length}</Tag></span>
          </h2>
          <div className="card table-wrap" style={{ marginBottom: 24 }}>
            <table className="data">
              <thead>
                <tr><th>Part</th><th>From → To</th><th>Reason</th><th>Requested by</th><th>When</th><th></th></tr>
              </thead>
              <tbody>
                {incoming.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`/assets/${t.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{t.asset_id}</Link></td>
                    <td>{t.from_branch} → {t.to_branch}</td>
                    <td style={{ maxWidth: 240 }}>{t.reason}</td>
                    <td>{t.requested_by_name}</td>
                    <td>{fmtDateTime(t.requested_at)}</td>
                    <td><DecideTransfer transferId={t.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Spare parts I can request */}
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>
        {profile.role === "admin" ? "Spare parts across branches" : "Spare parts in other branches"}
      </h2>
      <div className="card table-wrap" style={{ marginBottom: 24 }}>
        <table className="data">
          <thead>
            <tr><th>Part</th><th>Type</th><th>At branch</th><th>Location</th><th>Home</th><th></th></tr>
          </thead>
          <tbody>
            {spares.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No spare parts available to move right now.</td></tr>
            )}
            {spares.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/assets/${a.id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{a.id}</Link></td>
                <td>{partLabel(a)}</td>
                <td>{a.current_branch} · {branchName(a.current_branch)}</td>
                <td>{roomLabel(a)}{a.paired_with ? "" : " · unpaired"}</td>
                <td>{a.home_branch}</td>
                <td>
                  {destBranch ? (
                    <RequestMove assetId={a.id} toBranch={destBranch} fromBranch={a.current_branch} />
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>Managers request into their branch</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* My pending requests */}
      {outgoing.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Waiting for approval</h2>
          <div className="card table-wrap" style={{ marginBottom: 24 }}>
            <table className="data">
              <thead>
                <tr><th>Part</th><th>From → To</th><th>Reason</th><th>Requested</th><th>Status</th></tr>
              </thead>
              <tbody>
                {outgoing.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`/assets/${t.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{t.asset_id}</Link></td>
                    <td>{t.from_branch} → {t.to_branch}</td>
                    <td style={{ maxWidth: 240, color: "var(--muted)", fontSize: 13 }}>{t.reason}</td>
                    <td>{fmtDateTime(t.requested_at)}</td>
                    <td><Tag tone="amber">Awaiting {t.from_branch}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* History */}
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Move history</h2>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Part</th><th>From → To</th><th>Outcome</th><th>Decided by</th><th>When</th></tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No completed moves yet.</td></tr>
            )}
            {history.map((t) => (
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
