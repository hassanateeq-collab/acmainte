import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  getAsset,
  listAssets,
  listAssetEvents,
  listJobsForAsset,
  listBranches,
  jobTotal,
} from "@/lib/data";
import {
  assetStatus,
  nextServiceDate,
  daysToService,
  lifeLeftYears,
} from "@/lib/status";
import { mockOccupancy, isSwapped } from "@/lib/rows";
import { money, fmtDate, fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { StatusBadge, Tag } from "@/components/StatusBadge";
import AssetActions from "@/components/AssetActions";

export const dynamic = "force-dynamic";

export default async function AssetRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assetId = decodeURIComponent(id);
  const profile = await requireProfile();

  const [asset, allAssets, events, jobs, branches] = await Promise.all([
    getAsset(assetId),
    listAssets(),
    listAssetEvents(assetId),
    listJobsForAsset(assetId),
    listBranches(),
  ]);
  if (!asset) notFound();

  const byId = new Map(allAssets.map((a) => [a.id, a]));
  const paired = asset.paired_with ? byId.get(asset.paired_with) ?? null : null;

  // The set: interior + exterior, whichever this asset is.
  const interior = asset.part === "E" ? paired : asset;
  const exterior = asset.part === "E" ? asset : paired;

  const candidates = allAssets.filter(
    (a) => a.part && a.part !== asset.part && a.id !== asset.id
  );

  const status = assetStatus(asset);
  const dts = daysToService(asset);
  const nsd = nextServiceDate(asset);
  const totalSpent = jobs.reduce((s, j) => s + jobTotal(j), 0);
  const repairs = jobs.filter((j) => j.type === "Repair").length;
  const homeDiffers = asset.home_branch !== asset.current_branch;

  // Merge timeline.
  type T = { ts: string; title: string; body?: string; amount?: number; kind: string };
  const timeline: T[] = [];
  for (const e of events)
    timeline.push({ ts: e.created_at, title: e.description, kind: e.kind, body: e.actor_name ? `by ${e.actor_name}` : undefined });
  for (const j of jobs) {
    const extras = (j.job_charges ?? []).map((c) => `${c.label} ${money(c.amount)}`).join(", ");
    timeline.push({
      ts: j.created_at || j.date,
      title: `${j.type}${j.problem ? `: ${j.problem}` : ""}`,
      body: [j.work_done, extras ? `Additional: ${extras}` : "", `by ${j.created_by_name ?? "—"}`].filter(Boolean).join(" · "),
      amount: jobTotal(j),
      kind: "job",
    });
    for (const ed of j.job_edits ?? [])
      timeline.push({ ts: ed.created_at, title: `Edit: ${ed.summary}`, body: `${ed.reason} — ${ed.edited_by_name ?? ""}`, kind: "edit" });
  }
  timeline.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <div>
      <Link href="/assets" className="btn btn-sm" style={{ marginBottom: 14 }}>
        ← Back to assets
      </Link>
      <PageHeader
        title={asset.id}
        subtitle={`${asset.type} ${asset.part === "I" ? "interior" : asset.part === "E" ? "exterior" : ""} · ${
          asset.room && asset.room.toLowerCase() !== "store" ? `Room ${asset.room}` : "In store"
        } · ${asset.current_branch}${homeDiffers ? ` (originally from ${asset.home_branch})` : ""}`}
      />

      {/* Alerts */}
      {asset.open_issue && (
        <Alert tone="red" text={`Open issue: ${asset.open_issue}`} />
      )}
      {asset.at_vendor && <Alert tone="violet" text="This unit is with CoolTech." />}
      {homeDiffers && (
        <div style={{ marginBottom: 12 }}>
          <Tag tone="amber">Moved from {asset.home_branch}</Tag>
        </div>
      )}
      {asset.is_spare && !asset.at_vendor && (
        <Alert tone="amber" text="Labelled as spare — available for other branches to request on the Move page." />
      )}

      {/* Action bar */}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <AssetActions asset={asset} profile={profile} branches={branches} candidates={candidates} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }} className="rec-grid">
        {/* This AC set */}
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>This AC set</h2>
          <SetUnit label="Interior" a={interior} thisId={asset.id} />
          <div style={{ height: 10 }} />
          <SetUnit
            label="Exterior"
            a={exterior}
            thisId={asset.id}
            swapped={interior && exterior ? isSwapped(interior, exterior) : false}
          />
          {!paired && (
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
              {asset.part ? "Not connected to an opposite part (spare)." : ""}
            </p>
          )}
        </div>

        {/* Details */}
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>Details</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", margin: 0 }}>
            <Detail label="Status">
              <StatusBadge status={status} note={dts !== null && dts < 0 ? `Overdue ${Math.abs(dts)}d` : undefined} />
            </Detail>
            <Detail label="Occupancy">{mockOccupancy(asset.room)}</Detail>
            <Detail label="Last service">{fmtDate(asset.last_service_date)}</Detail>
            <Detail label="Next service">
              {fmtDate(nsd ? nsd.toISOString() : null)}
              {dts !== null && (
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 2,
                    color: dts <= 0 ? "#b91c1c" : dts <= 14 ? "#b45309" : "var(--muted)",
                  }}
                >
                  {dts < 0
                    ? `overdue ${-dts} day${-dts === 1 ? "" : "s"}`
                    : dts === 0
                    ? "due today"
                    : `in ${dts} day${dts === 1 ? "" : "s"}`}
                  {dts > 0 && dts <= 14 ? " · service due" : ""}
                </div>
              )}
            </Detail>
            <Detail label="Installed">{fmtDate(asset.installed_date)}</Detail>
            <Detail label="Life left">
              {(() => {
                const l = lifeLeftYears(asset);
                return l === null ? "—" : `${l} yr`;
              })()}
            </Detail>
            <Detail label="Times repaired">{repairs}</Detail>
            <Detail label="Total spent">{money(totalSpent)}</Detail>
          </dl>
        </div>
      </div>

      {/* Timeline */}
      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>Timeline</h2>
        {timeline.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No history yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {timeline.map((t, i) => (
              <li key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < timeline.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: "var(--brand)", marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>{t.title}</span>
                    {t.amount != null && <span>{money(t.amount)}</span>}
                  </div>
                  {t.body && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{t.body}</div>}
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{fmtDateTime(t.ts)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`@media (max-width: 800px){ .rec-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function Alert({ tone, text }: { tone: "red" | "violet" | "amber"; text: string }) {
  const c =
    tone === "red"
      ? { bg: "#fef2f2", bd: "#fecaca", fg: "#b91c1c" }
      : tone === "amber"
      ? { bg: "#fffbeb", bd: "#fde68a", fg: "#92400e" }
      : { bg: "#f5f3ff", bd: "#ddd6fe", fg: "#6d28d9" };
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
      {text}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{label}</dt>
      <dd style={{ margin: "3px 0 0", fontSize: 14 }}>{children}</dd>
    </div>
  );
}

async function SetUnit({
  label,
  a,
  thisId,
  swapped,
}: {
  label: string;
  a: Awaited<ReturnType<typeof getAsset>>;
  thisId: string;
  swapped?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 12,
        background: a?.id === thisId ? "#f0fbf9" : "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      {a ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div>
            {a.id === thisId ? (
              <span style={{ fontWeight: 700 }}>{a.id} <Tag tone="brand">this unit</Tag></span>
            ) : (
              <Link href={`/assets/${a.id}`} style={{ fontWeight: 700, color: "var(--brand-ink)" }}>{a.id}</Link>
            )}
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.current_branch}</div>
          </div>
          {swapped && <Tag tone="amber">Swapped</Tag>}
        </div>
      ) : (
        <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}>— not connected —</div>
      )}
    </div>
  );
}
