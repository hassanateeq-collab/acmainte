"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { NavItem } from "@/lib/nav";
import type { Profile } from "@/lib/types";
import { roleLabel } from "@/lib/perms";
import { signOutAction } from "@/app/actions/session";

export default function Shell({
  profile,
  branchName,
  nav,
  badges,
  children,
}: {
  profile: Profile;
  branchName: string | null;
  nav: NavItem[];
  badges: { transfers: number; notifications: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const scopeLabel =
    profile.role === "admin"
      ? "All branches"
      : profile.role === "repair"
      ? "CoolTech Services"
      : branchName ?? "—";

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const navList = (
    <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {nav.map((item) => {
        const active = isActive(item.href);
        const badge =
          item.badgeKey === "transfers"
            ? badges.transfers
            : item.badgeKey === "notifications"
            ? badges.notifications
            : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "9px 12px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              color: active ? "#fff" : "var(--ink)",
              background: active ? "var(--brand)" : "transparent",
            }}
          >
            <span>{item.label}</span>
            {badge > 0 && (
              <span
                style={{
                  minWidth: 20,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: active ? "rgba(255,255,255,.25)" : "#eef1f4",
                  color: active ? "#fff" : "var(--muted)",
                }}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: "var(--brand)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
        }}
      >
        H
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
          Hamsun Assets
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{scopeLabel}</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Top bar (mobile) */}
      <div
        className="topbar-mobile"
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        {brand}
        <button className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
          Menu
        </button>
      </div>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <aside
          className={`sidebar ${open ? "sidebar-open" : ""}`}
          style={{
            width: 248,
            flexShrink: 0,
            borderRight: "1px solid var(--line)",
            background: "#fff",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            position: "sticky",
            top: 0,
            height: "100vh",
          }}
        >
          <div className="brand-desktop">{brand}</div>
          {navList}
          <div style={{ marginTop: "auto" }}>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "#f6f7f9",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {profile.full_name || profile.email}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {roleLabel(profile.role)}
              </div>
            </div>
            <form action={signOutAction}>
              <button className="btn" style={{ width: "100%", justifyContent: "center" }}>
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0, padding: "clamp(16px, 3vw, 32px)" }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .topbar-mobile { display: flex !important; }
          .brand-desktop { display: none; }
          .sidebar {
            position: fixed !important;
            z-index: 40;
            left: 0; top: 0;
            transform: translateX(-100%);
            transition: transform .18s ease;
            box-shadow: 0 10px 40px rgba(0,0,0,.15);
          }
          .sidebar-open { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
