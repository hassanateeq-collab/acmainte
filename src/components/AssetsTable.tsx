"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StatusBadge, Tag } from "./StatusBadge";
import DeleteAsset from "./DeleteAsset";
import EditAsset from "./EditAsset";
import { fmtDate, money } from "@/lib/format";
import type { AssetStatus } from "@/lib/types";

type ClientUnit = {
  id: string;
  status: AssetStatus;
  swappedHome: string;
  room: string | null;
  installed_date: string | null;
  last_service_date: string | null;
  last_general_service_date: string | null;
  expected_life_years: number;
  service_interval_days: number;
  general_interval_days: number;
} | null;

export type ClientRow = {
  key: string;
  branch: string;
  room: string | null;
  occupancy: string;
  interior: ClientUnit;
  exterior: ClientUnit;
  swapped: boolean;
  generalService: string | null;
  generalDays: number | null;
  generalDueNow: boolean;
  generalLeft: number | null;
  generalMissed: number;
  masterService: string | null;
  masterDays: number | null;
  masterDueNow: boolean;
  masterLeft: number | null;
  masterMissed: number;
  lifeLeft: number | null;
  repairs: number;
  total: number;
};

const STATUSES: (AssetStatus | "All")[] = [
  "All",
  "Healthy",
  "Service due",
  "Issue reported",
  "With CoolTech",
];

export default function AssetsTable({
  rows,
  branches,
  showBranchTabs,
  viewer,
}: {
  rows: ClientRow[];
  branches: { code: string; name: string }[];
  showBranchTabs: boolean;
  viewer: { role: string; branch: string | null };
}) {
  const canDelete = (rowBranch: string) =>
    viewer.role === "admin" ||
    (viewer.role === "branch_manager" && viewer.branch === rowBranch);
  const showActions = viewer.role !== "repair";
  const params = useSearchParams();
  const initialStatus = (params.get("status") as AssetStatus) || "All";

  const [branch, setBranch] = useState<string>("All");
  const [status, setStatus] = useState<AssetStatus | "All">(
    STATUSES.includes(initialStatus) ? initialStatus : "All"
  );
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      // A branch manager only ever sees assets currently at their own branch
      // (so parts moved in from elsewhere show here, and moved-out ones drop off).
      if (
        viewer.role === "branch_manager" &&
        viewer.branch &&
        r.branch !== viewer.branch
      )
        return false;
      if (showBranchTabs && branch !== "All" && r.branch !== branch) return false;
      if (status !== "All") {
        const s = [r.interior?.status, r.exterior?.status].filter(Boolean);
        if (!s.includes(status)) return false;
      }
      if (query) {
        const hay = [
          r.interior?.id,
          r.exterior?.id,
          r.room,
          r.branch,
          r.occupancy,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, branch, status, q, showBranchTabs, viewer.role, viewer.branch]);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        {showBranchTabs && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["All", ...branches.map((b) => b.code)].map((b) => (
              <button
                key={b}
                className="btn btn-sm"
                onClick={() => setBranch(b)}
                style={
                  branch === b
                    ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }
                    : undefined
                }
              >
                {b}
              </button>
            ))}
          </div>
        )}
        <select className="select" style={{ width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value as AssetStatus | "All")}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>
          ))}
        </select>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Filter by ID, room…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>
          {filtered.length} of{" "}
          {viewer.role === "branch_manager" && viewer.branch
            ? rows.filter((r) => r.branch === viewer.branch).length
            : rows.length}
        </div>
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Branch</th>
              <th>Room</th>
              <th>Interior</th>
              <th>Exterior</th>
              <th>General service</th>
              <th>Master service</th>
              <th>Missed</th>
              <th>Life left</th>
              <th>Repairs</th>
              <th>Total spent</th>
              {showActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showActions ? 11 : 10} style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>
                  No assets match.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.key}>
                <td>{r.branch}</td>
                <td>
                  {r.room && r.room.toLowerCase() !== "store" ? r.room : <span style={{ color: "var(--muted)" }}>Store</span>}
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.occupancy}</div>
                </td>
                <td>
                  {r.interior ? (
                    <Link href={`/assets/${r.interior.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <div style={{ fontWeight: 600 }}>{r.interior.id}</div>
                      <StatusBadge status={r.interior.status} />
                    </Link>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
                <td>
                  {r.exterior ? (
                    <Link href={`/assets/${r.exterior.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <div style={{ fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
                        {r.exterior.id}
                        {r.swapped && <Tag tone="amber">Swapped</Tag>}
                      </div>
                      <StatusBadge status={r.exterior.status} />
                    </Link>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <ServiceCell date={r.generalService} days={r.generalDays} dueNow={r.generalDueNow} left={r.generalLeft} />
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <ServiceCell date={r.masterService} days={r.masterDays} dueNow={r.masterDueNow} left={r.masterLeft} />
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <MissedCell general={r.generalMissed} master={r.masterMissed} />
                </td>
                <td>{r.lifeLeft === null ? "—" : `${r.lifeLeft} yr`}</td>
                <td>{r.repairs}</td>
                <td>{money(r.total)}</td>
                {showActions && (
                  <td>
                    {canDelete(r.branch) ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        {r.interior && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 24 }}>Int</span>
                            <EditAsset asset={r.interior} />
                            <DeleteAsset assetId={r.interior.id} />
                          </div>
                        )}
                        {r.exterior && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 24 }}>Ext</span>
                            <EditAsset asset={r.exterior} />
                            <DeleteAsset assetId={r.exterior.id} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiceCell({
  date,
  days,
  dueNow,
  left,
}: {
  date: string | null;
  days: number | null;
  dueNow: boolean;
  left: number | null;
}) {
  return (
    <>
      {fmtDate(date)}
      {days !== null && (
        <div style={{ fontSize: 11.5, color: dueNow ? "#b91c1c" : "var(--muted)" }}>
          {dueNow
            ? `DUE${left !== null ? ` · ${left}d left` : ""}`
            : `in ${days}d`}
        </div>
      )}
    </>
  );
}

function MissedCell({ general, master }: { general: number; master: number }) {
  const total = general + master;
  if (total === 0) return <span style={{ color: "var(--muted)" }}>0</span>;
  return (
    <span>
      <span
        style={{
          display: "inline-block",
          minWidth: 20,
          textAlign: "center",
          padding: "1px 7px",
          borderRadius: 999,
          background: "#fef2f2",
          color: "#b91c1c",
          fontWeight: 700,
          fontSize: 12.5,
        }}
      >
        {total}
      </span>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
        Gen {general} · Mas {master}
      </div>
    </span>
  );
}
