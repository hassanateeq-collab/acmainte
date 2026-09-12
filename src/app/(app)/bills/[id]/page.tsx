import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getJobWithAsset, listBranches, jobTotal } from "@/lib/data";
import { money, fmtDate, fmtDateTime } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  Service: "Servicing",
  Repair: "Repair",
  Charge: "Charge",
};

export default async function BillInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const result = await getJobWithAsset(id);
  if (!result) notFound();

  const { job, asset } = result;

  // Branch managers can only see invoices for assets in their own branch.
  if (
    profile.role === "branch_manager" &&
    asset &&
    asset.current_branch !== profile.branch_code
  ) {
    notFound();
  }

  const branches = await listBranches();
  const branchName =
    branches.find((b) => b.code === asset?.current_branch)?.name ??
    asset?.current_branch ??
    "—";

  const charges = job.job_charges ?? [];
  const total = jobTotal(job);
  const partLabel =
    asset?.part === "I" ? "Interior" : asset?.part === "E" ? "Exterior" : "—";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Toolbar — hidden when printing */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link href="/bills" className="btn">
          ← Back to bills
        </Link>
        <PrintButton label="🖨 Print / Save PDF" />
      </div>

      {/* The invoice sheet */}
      <div className="card" style={{ padding: 32 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            borderBottom: "2px solid var(--brand)",
            paddingBottom: 18,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--brand-ink)" }}>
              Hamsun Assets
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              Asset &amp; Maintenance Portal
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>
              {TYPE_LABEL[job.type] ?? job.type} bill
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
              Invoice #{job.id.slice(0, 8).toUpperCase()}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Date: {fmtDate(job.date)}
            </div>
          </div>
        </div>

        {/* Vendor / asset blocks */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div>
            <div style={secLabel}>Serviced by</div>
            <div style={{ fontWeight: 700 }}>CoolTech Services</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Repair &amp; maintenance vendor
            </div>
          </div>
          <div>
            <div style={secLabel}>Asset</div>
            <div style={{ fontWeight: 700 }}>{job.asset_id}</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {asset?.type ?? "AC"} · {partLabel}
              {asset?.room ? ` · Room ${asset.room}` : ""}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Branch: {branchName}
            </div>
          </div>
        </div>

        {/* Work details */}
        {(job.problem || job.work_done) && (
          <div style={{ marginBottom: 20 }}>
            <div style={secLabel}>Work details</div>
            {job.problem && (
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                <span style={{ color: "var(--muted)" }}>Problem / request: </span>
                {job.problem}
              </div>
            )}
            {job.work_done && (
              <div style={{ fontSize: 14 }}>
                <span style={{ color: "var(--muted)" }}>Work done: </span>
                {job.work_done}
              </div>
            )}
            {job.days_taken > 0 && (
              <div style={{ fontSize: 14, marginTop: 4 }}>
                <span style={{ color: "var(--muted)" }}>Days taken: </span>
                {job.days_taken}
              </div>
            )}
          </div>
        )}

        {/* Charges table */}
        <table className="data" style={{ marginBottom: 4 }}>
          <thead>
            <tr>
              <th>Description</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {TYPE_LABEL[job.type] ?? job.type}
                {job.problem ? ` — ${job.problem}` : ""}
              </td>
              <td style={{ textAlign: "right" }}>{money(job.bill_amount)}</td>
            </tr>
            {charges.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.label}
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    {" "}· {fmtDate(c.date)}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>{money(c.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 800, fontSize: 15, borderTop: "2px solid var(--line)" }}>
                Total
              </td>
              <td
                style={{
                  textAlign: "right",
                  fontWeight: 800,
                  fontSize: 15,
                  borderTop: "2px solid var(--line)",
                }}
              >
                {money(total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Edit note */}
        {(job.job_edits ?? []).length > 0 && (
          <div style={{ fontSize: 12, color: "#b45309", marginTop: 10 }}>
            This bill has {(job.job_edits ?? []).length} logged change(s). See the
            audit trail for details.
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 28,
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12.5,
            color: "var(--muted)",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>Recorded by: {job.created_by_name ?? "—"}</div>
          <div>Generated {fmtDateTime(new Date().toISOString())}</div>
        </div>
      </div>
    </div>
  );
}

const secLabel: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--muted)",
  marginBottom: 4,
};
