import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  listAssets,
  listAllJobs,
  listTransfers,
  listNotifications,
  jobTotal,
} from "@/lib/data";
import { audiencesFor } from "@/lib/perms";
import { assetStatus, daysToService } from "@/lib/status";
import { money, relativeTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await requireProfile();
  const [assetsAll, jobs, transfers, notifications] = await Promise.all([
    listAssets(),
    listAllJobs(),
    listTransfers(),
    listNotifications(audiencesFor(profile)),
  ]);

  const inScope =
    profile.role === "branch_manager"
      ? assetsAll.filter((a) => a.current_branch === profile.branch_code)
      : assetsAll;

  const serviceDue = inScope.filter((a) => {
    if (a.at_vendor) return false;
    const d = daysToService(a);
    return d !== null && d <= 14;
  });
  const openIssues = inScope.filter((a) => a.open_issue);
  const withCoolTech = inScope.filter((a) => a.at_vendor);

  const waiting = transfers.filter((t) => {
    if (t.status !== "waiting") return false;
    if (profile.role === "admin") return true;
    if (profile.role === "branch_manager") return t.from_branch === profile.branch_code;
    return false;
  });

  const year = new Date().getFullYear();
  const scopedAssetIds = new Set(inScope.map((a) => a.id));
  const billedThisYear = jobs
    .filter((j) => new Date(j.date).getFullYear() === year)
    .filter((j) => profile.role === "branch_manager" ? scopedAssetIds.has(j.asset_id) : true)
    .reduce((s, j) => s + jobTotal(j), 0);

  const greeting =
    profile.role === "admin"
      ? "Head office — every branch"
      : profile.role === "repair"
      ? "CoolTech Services"
      : `${profile.branch_code ?? "Your"} branch`;

  const tiles = [
    { label: "AC parts tracked", value: inScope.length, href: "/assets" },
    { label: "Service due (≤14 days)", value: serviceDue.length, href: "/service", tone: "amber" as const },
    { label: "Open issues", value: openIssues.length, href: profile.role === "repair" ? "/issues" : "/assets?status=Issue%20reported", tone: "red" as const },
    { label: "With CoolTech", value: withCoolTech.length, href: profile.role === "repair" ? "/issues" : "/assets?status=With%20CoolTech", tone: "violet" as const },
    profile.role === "repair"
      ? { label: `Billed in ${year}`, value: money(billedThisYear), href: "/bills" }
      : { label: "Transfers to decide", value: waiting.length, href: "/transfers", tone: "brand" as const },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome — ${profile.full_name || profile.email}`}
        subtitle={`${greeting}. Here is what needs your attention today.`}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {tiles.map((t, i) => (
          <Link key={i} href={t.href} className="card" style={{ padding: 16, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>{t.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{t.value}</div>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 16 }} className="home-grid">
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Needs attention</h2>
          <NeedsAttention
            waiting={waiting.map((t) => ({ id: t.id, asset: t.asset_id, from: t.from_branch, to: t.to_branch }))}
            issues={openIssues.map((a) => ({ id: a.id, room: a.room, issue: a.open_issue! }))}
            due={serviceDue.map((a) => ({ id: a.id, d: daysToService(a)! }))}
            vendor={withCoolTech.map((a) => a.id)}
            role={profile.role}
          />
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Recent activity</h2>
          {notifications.slice(0, 6).length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>Nothing yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {notifications.slice(0, 6).map((n) => (
                <li key={n.id} style={{ fontSize: 13.5, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{n.message}</span>
                  <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{relativeTime(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/notifications" className="btn btn-sm" style={{ marginTop: 12 }}>
            See all notifications
          </Link>
        </div>
      </div>

      <style>{`@media (max-width: 800px){ .home-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function NeedsAttention({
  waiting,
  issues,
  due,
  vendor,
  role,
}: {
  waiting: { id: string; asset: string; from: string; to: string }[];
  issues: { id: string; room: string | null; issue: string }[];
  due: { id: string; d: number }[];
  vendor: string[];
  role: string;
}) {
  const items: React.ReactNode[] = [];

  waiting.forEach((t) =>
    items.push(
      <Row key={`t-${t.id}`} text={`Transfer of ${t.asset} from ${t.from} → ${t.to} is waiting for a decision.`} href="/transfers" action="Decide" />
    )
  );
  issues.forEach((a) =>
    items.push(
      <Row key={`i-${a.id}`} text={`${a.id}${a.room ? ` (room ${a.room})` : ""} has an open issue: ${a.issue}`} href={`/assets/${a.id}`} action={role === "repair" ? "Log repair" : "Open"} />
    )
  );
  due.forEach((a) =>
    items.push(
      <Row
        key={`d-${a.id}`}
        text={a.d < 0 ? `${a.id} service is overdue by ${Math.abs(a.d)} days.` : `${a.id} is due for service in ${a.d} days.`}
        href={`/assets/${a.id}`}
        action="Log service"
      />
    )
  );
  vendor.forEach((id) =>
    items.push(<Row key={`v-${id}`} text={`${id} is with CoolTech.`} href={`/assets/${id}`} action="Open" />)
  );

  if (items.length === 0)
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>All clear — nothing needs attention.</p>;

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {items.slice(0, 12)}
    </ul>
  );
}

function Row({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <li style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
      <span>{text}</span>
      <Link href={href} className="btn btn-sm" style={{ flexShrink: 0 }}>{action}</Link>
    </li>
  );
}
