import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listAllJobs, listAssets, jobTotal } from "@/lib/data";
import { money, fmtDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import BillActions from "@/components/BillActions";
import StandaloneCharge from "@/components/StandaloneCharge";
import { Tag } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const profile = await requireProfile();
  const [jobs, assets] = await Promise.all([listAllJobs(), listAssets()]);
  const branchOf = new Map(assets.map((a) => [a.id, a.current_branch]));

  const scoped =
    profile.role === "branch_manager"
      ? jobs.filter((j) => branchOf.get(j.asset_id) === profile.branch_code)
      : jobs;

  const totalBill = scoped.reduce((s, j) => s + Number(j.bill_amount || 0), 0);
  const totalAdd = scoped.reduce(
    (s, j) => s + (j.job_charges ?? []).reduce((x, c) => x + Number(c.amount || 0), 0),
    0
  );
  const grand = totalBill + totalAdd;
  const canEdit = profile.role === "admin" || profile.role === "repair";

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
        actions={canEdit ? <StandaloneCharge assets={chargeAssets} /> : undefined}
      />

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
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {scoped.length === 0 && (
              <tr><td colSpan={canEdit ? 10 : 9} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>No bill entries yet.</td></tr>
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
                  <td style={{ fontWeight: 700 }}>{money(jobTotal(j))}</td>
                  <td>{j.days_taken || 0}</td>
                  <td style={{ fontSize: 13 }}>{j.created_by_name ?? "—"}</td>
                  {canEdit && (
                    <td>
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
