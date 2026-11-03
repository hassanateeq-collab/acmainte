import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listFirHistory } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { Tag } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const profile = await requireProfile();
  const branch = profile.role === "branch_manager" ? profile.branch_code : null;
  const history = await listFirHistory(branch);

  const resolved = history.filter((h) => h.resolved_at).length;
  const rejected = history.filter((h) => h.rejected_at).length;
  const open = history.filter(
    (h) => !h.resolved_at && !h.rejected_at && (h.asset_ids?.length ?? 0) > 0
  ).length;

  return (
    <div>
      <PageHeader
        title="History"
        subtitle="Every AC issue received from the FIR portal — the branch and room, the AC it was linked to, and whether it was resolved, rejected, or not about an AC."
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span className="chip" style={{ background: "#eef1f4", color: "#5b6470" }}>
          {history.length} total
        </span>
        <span className="chip" style={{ background: "#fef2f2", color: "#b91c1c" }}>
          {open} open
        </span>
        <span className="chip" style={{ background: "#ecfdf5", color: "#047857" }}>
          {resolved} resolved &amp; repaired
        </span>
        {rejected > 0 && (
          <span className="chip" style={{ background: "#f3f4f6", color: "#6b7280" }}>
            {rejected} rejected
          </span>
        )}
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>FIR</th>
              <th>Branch / room</th>
              <th>AC(s)</th>
              <th>Reported</th>
              <th>Resolved</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>
                  No FIR issues recorded yet.
                </td>
              </tr>
            )}
            {history.map((h) => {
              const acs = h.asset_ids ?? [];
              const done = !!h.resolved_at;
              const isRejected = !!h.rejected_at;
              const noAc = acs.length === 0;
              return (
                <tr key={h.fir_issue_id} style={isRejected ? { opacity: 0.6 } : undefined}>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{h.fir_no || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {h.branch || "—"}
                    {h.room_no ? ` · ${h.room_no}` : ""}
                  </td>
                  <td>
                    {noAc ? (
                      <span style={{ color: "var(--muted)" }}>no AC linked</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {acs.map((id) => (
                          <Link
                            key={id}
                            href={`/assets/${id}`}
                            style={{ fontWeight: 600, color: "var(--brand-ink)" }}
                          >
                            {id}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12.5 }}>
                    {fmtDateTime(h.created_at)}
                  </td>
                  <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12.5 }}>
                    {done ? fmtDateTime(h.resolved_at) : "—"}
                  </td>
                  <td>
                    {isRejected ? (
                      <Tag>Rejected · not an AC issue</Tag>
                    ) : done ? (
                      <Tag tone="brand">Resolved &amp; repaired</Tag>
                    ) : noAc ? (
                      <Tag>No AC matched</Tag>
                    ) : (
                      <Tag tone="amber">Open</Tag>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
