import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listAssets, listTransfers, listBranches } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import RequestMove from "@/components/RequestMove";
import MarkInstalled from "@/components/MarkInstalled";
import { Tag } from "@/components/StatusBadge";
import type { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";

/** A part is offered on the Move page when its branch manager has labelled it
 *  a spare (and it isn't currently with the vendor). */
function isSpare(a: Asset): boolean {
  if (a.at_vendor) return false;
  return !!a.is_spare;
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

  const myBranch = profile.branch_code;

  // Assets that already have an open request — don't offer them again.
  const pendingAssetIds = new Set(
    transfers.filter((t) => t.status === "waiting").map((t) => t.asset_id)
  );

  // Moves accepted but not yet installed by the receiving branch.
  const awaitingInstall = transfers.filter(
    (t) => t.status === "accepted" && !t.installed
  );

  /* ------------------------------------------------ admin + branch manager */

  // Spare parts I could pull in. Admin sees all branches; a branch manager
  // sees spares that are NOT already in their own branch.
  const spares = assets
    .filter(isSpare)
    .filter((a) => !pendingAssetIds.has(a.id))
    .filter((a) => (profile.role === "branch_manager" ? a.current_branch !== myBranch : true))
    .sort((a, b) => (a.current_branch + a.id).localeCompare(b.current_branch + b.id));

  // Requests I need to decide now live on the dedicated Approvals page.
  const toApprove = transfers.filter(
    (t) =>
      t.status === "waiting" &&
      (profile.role === "admin" || t.from_branch === myBranch)
  ).length;

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

      {/* Pointer to the Approvals page when requests are waiting on me */}
      {toApprove > 0 && (
        <div
          className="card"
          style={{ padding: "12px 16px", marginBottom: 20, background: "#fffbeb", borderColor: "#fde68a", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
        >
          <span style={{ fontSize: 14, color: "#92400e", fontWeight: 600 }}>
            {toApprove} move request{toApprove === 1 ? "" : "s"} waiting for your approval.
          </span>
          <Link href="/approvals" className="btn btn-sm btn-primary">Go to Approvals →</Link>
        </div>
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

      {/* Accepted, waiting for the receiving branch to confirm installation */}
      {(() => {
        const mine = awaitingInstall.filter(
          (t) => profile.role === "admin" || t.to_branch === myBranch
        );
        if (mine.length === 0) return null;
        return (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>
              To install
              <span style={{ marginLeft: 8 }}><Tag tone="amber">{mine.length}</Tag></span>
            </h2>
            <div className="card" style={{ padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "var(--muted)" }}>
              Confirm each unit once it&apos;s physically fitted in its room.
            </div>
            <div className="card table-wrap" style={{ marginBottom: 24 }}>
              <table className="data">
                <thead>
                  <tr><th>Part</th><th>Moved to</th><th>Install room</th><th>Accepted</th><th></th></tr>
                </thead>
                <tbody>
                  {mine.map((t) => {
                    const canInstall =
                      profile.role === "admin" || t.to_branch === myBranch;
                    return (
                      <tr key={t.id}>
                        <td><Link href={`/assets/${t.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{t.asset_id}</Link></td>
                        <td>{t.to_branch}</td>
                        <td style={{ fontWeight: 600 }}>{t.to_room ? `Room ${t.to_room}` : "—"}</td>
                        <td>{fmtDateTime(t.decided_at)}</td>
                        <td>
                          {canInstall ? (
                            <MarkInstalled transferId={t.id} room={t.to_room} />
                          ) : (
                            <Tag tone="amber">Awaiting {t.to_branch}</Tag>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

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
