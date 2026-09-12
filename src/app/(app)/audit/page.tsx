import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listJobEdits } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    return (
      <div>
        <PageHeader title="Audit trail" />
        <p style={{ color: "var(--muted)" }}>Only Admin can view the audit trail.</p>
      </div>
    );
  }

  const edits = await listJobEdits();

  return (
    <div>
      <PageHeader
        title="Audit trail"
        subtitle="Every change to a bill entry — what changed, why, and who did it. Money records are never silently altered."
      />
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>When</th><th>Asset</th><th>Change</th><th>Reason</th><th>By</th></tr>
          </thead>
          <tbody>
            {edits.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>No changes logged yet.</td></tr>
            )}
            {edits.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(e.created_at)}</td>
                <td>
                  {e.jobs?.asset_id ? (
                    <Link href={`/assets/${e.jobs.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>
                      {e.jobs.asset_id}
                    </Link>
                  ) : "—"}
                </td>
                <td style={{ maxWidth: 320 }}>{e.summary}</td>
                <td style={{ maxWidth: 280, color: "var(--muted)" }}>{e.reason}</td>
                <td style={{ fontSize: 13 }}>{e.edited_by_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
