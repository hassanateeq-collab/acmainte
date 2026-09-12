import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listAllJobs, listAssets, jobTotal } from "@/lib/data";
import { money, fmtDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import BillActions from "@/components/BillActions";
import StandaloneCharge from "@/components/StandaloneCharge";
import PrintButton from "@/components/PrintButton";
import { Tag } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const profile = await requireProfile();
  const { from = "", to = "" } = await searchParams;
  const [jobs, assets] = await Promise.all([listAllJobs(), listAssets()]);
  const branchOf = new Map(assets.map((a) => [a.id, a.current_branch]));

  const branchScoped =
    profile.role === "branch_manager"
      ? jobs.filter((j) => branchOf.get(j.asset_id) === profile.branch_code)
      : jobs;

  // Date-range filter (inclusive). Job dates are ISO "YYYY-MM-DD" strings,
  // so plain string comparison is safe.
  const scoped = branchScoped.filter((j) => {
    const d = String(j.date || "").slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  const filtered = Boolean(from || to);

  const totalBill = scoped.reduce((s, j) => s + Number(j.bill_amount || 0), 0);
  const totalAdd = scoped.reduce(
    (s, j) => s + (j.job_charges ?? []).reduce((x, c) => x + Number(c.amount || 0), 0),
    0
  );
  const grand = totalBill + totalAdd;
  // Admin manages all charges + audit. Branch managers view only.
  const canAdd = profile.role === "admin";
  const canEdit = profile.role === "admin";
  const showActions = canAdd || canEdit;

  const chargeAssets = assets.map((a) => ({ id: a.id, branch: a.current_branch }));

  const tiles = [
    { label: "Total bills", value: money(totalBill) },
    { label: "Additional charges", value: money(totalAdd) },
    { label: "Grand total", value: money(grand) },
    { label: "Entries", value: scoped.length },
  ];

  return (
    <div>
      <PageHeader
        title="Bills"
        subtitle="Every service, repair and charge with its amount. Money records keep a change log."
        actions={
          <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <PrintButton />
            {canAdd && <StandaloneCharge assets={chargeAssets} />}
          </div>
        }
      />

      {/* Shown only when printing / saving as PDF */}
      <div className="print-only" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Hamsun Assets — Bills</div>
        <div style={{ fontSize: 12, color: "#555" }}>
          {profile.role === "branch_manager" ? `Branch ${profile.branch_code}` : "All branches"} ·
          Generated {new Date().toLocaleString("en-GB")}
        </div>
      </div>

      {/* Date-range filter */}
      <form
        method="GET"
        className="card no-print"
        style={{
          padding: 14,
          marginBottom: 16,
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <label className="label" htmlFor="from">From date</label>
          <input type="date" id="from" name="from" defaultValue={from} className="input" style={{ width: 170 }} />
        </div>
        <div>
          <label className="label" htmlFor="to">To date</label>
          <input type="date" id="to" name="to" defaultValue={to} className="input" style={{ width: 170 }} />
        </div>
        <button type="submit" className="btn btn-primary">Apply</button>
        {filtered && (
          <Link href="/bills" className="btn">Clear</Link>
        )}
        {filtered && (
          <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: "auto" }}>
            Showing {scoped.length} entr{scoped.length === 1 ? "y" : "ies"}
            {from && ` from ${fmtDate(from)}`}
            {to && ` to ${fmtDate(to)}`}
          </span>
        )}
      </form>

      {/* Shown only when printing / saving as PDF — echoes the active range */}
      {filtered && (
        <div className="print-only" style={{ marginBottom: 10, fontSize: 12, color: "#555" }}>
          Period: {from ? fmtDate(from) : "start"} — {to ? fmtDate(to) : "today"}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {tiles.map((t, i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>{t.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{t.value}</div>
          </div>
        ))}
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th><th>Asset</th><th>Type</th><th>Problem / work</th>
              <th>Bill</th><th>Additional</th><th>Total</th><th>Days</th><th>By</th>
              {showActions && <th className="no-print">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {scoped.length === 0 && (
              <tr><td colSpan={showActions ? 10 : 9} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>No bill entries yet.</td></tr>
            )}
            {scoped.map((j) => {
              const charges = j.job_charges ?? [];
              const add = charges.reduce((s, c) => s + Number(c.amount || 0), 0);
              return (
                <tr key={j.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(j.date)}</td>
                  <td><Link href={`/assets/${j.asset_id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>{j.asset_id}</Link></td>
                  <td>
                    {j.type === "Charge" ? <Tag>Charge</Tag> : j.type === "Repair" ? <Tag tone="amber">Repair</Tag> : <Tag tone="brand">Service</Tag>}
                  </td>
                  <td style={{ maxWidth: 240 }}>
                    {j.problem}
                    {j.work_done && <div style={{ fontSize: 12, color: "var(--muted)" }}>{j.work_done}</div>}
                    {(j.job_edits ?? []).length > 0 && (
                      <div style={{ fontSize: 11.5, color: "#b45309", marginTop: 3 }}>
                        {(j.job_edits ?? []).length} edit(s) logged
                      </div>
                    )}
                  </td>
                  <td>{money(j.bill_amount)}</td>
                  <td>
                    {add > 0 ? money(add) : "—"}
                    {charges.length > 0 && (
                      <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none" }}>
                        {charges.map((c) => (
                          <li key={c.id} style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.label}: {money(c.amount)}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {money(jobTotal(j))}
                    <div className="no-print" style={{ marginTop: 3 }}>
                      <Link
                        href={`/bills/${j.id}`}
                        style={{ fontSize: 12, color: "var(--brand-ink)", fontWeight: 600 }}
                      >
                        🧾 Bill
                      </Link>
                    </div>
                  </td>
                  <td>{j.days_taken || 0}</td>
                  <td style={{ fontSize: 13 }}>{j.created_by_name ?? "—"}</td>
                  {showActions && (
                    <td className="no-print">
                      <BillActions
                        job={{
                          id: j.id,
                          date: j.date,
                          type: j.type,
                          problem: j.problem,
                          work_done: j.work_done,
                          bill_amount: Number(j.bill_amount),
                          days_taken: j.days_taken,
                        }}
                        canAdd={canAdd}
                        canEdit={canEdit}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
