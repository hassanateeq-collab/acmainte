import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listNotifications } from "@/lib/data";
import { audiencesFor } from "@/lib/perms";
import { relativeTime } from "@/lib/format";
import { markAllReadAction } from "@/app/actions/notifications";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const notifications = await listNotifications(audiencesFor(profile));
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={
          profile.role === "admin"
            ? "Everything, across all branches."
            : profile.role === "repair"
            ? "The CoolTech inbox."
            : `${profile.branch_code} branch inbox.`
        }
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <button className="btn" type="submit">Mark all read ({unread})</button>
            </form>
          ) : undefined
        }
      />

      <div className="card">
        {notifications.length === 0 ? (
          <p style={{ color: "var(--muted)", padding: 24, textAlign: "center" }}>No notifications.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {notifications.map((n, i) => (
              <li
                key={n.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < notifications.length - 1 ? "1px solid var(--line)" : "none",
                  background: n.read ? "transparent" : "#f0fbf9",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: 999, marginTop: 6, flexShrink: 0,
                      background: n.read ? "transparent" : "var(--brand)",
                      border: n.read ? "1px solid var(--line)" : "none",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: n.read ? 500 : 700 }}>
                      {n.asset_id ? <Link href={`/assets/${n.asset_id}`} style={{ color: "inherit" }}>{n.message}</Link> : n.message}
                    </div>
                    {profile.role === "admin" && (
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{n.audience}</div>
                    )}
                  </div>
                </div>
                <span style={{ color: "var(--muted)", fontSize: 12.5, whiteSpace: "nowrap" }}>{relativeTime(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
