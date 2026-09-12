"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import AddAssetForm from "./forms/AddAssetForm";
import type { AssetStatus, AssetType, Branch, Profile } from "@/lib/types";

type Unit = { id: string; status: AssetStatus } | null;

export type RoomRow = {
  id: string;
  branch: string;
  room_number: string;
  status: string | null;
  status_note: string | null;
  interior: Unit;
  exterior: Unit;
};

const OCC = ["All", "Occupied", "Vacant", "Blocked"];

function occChip(status: string | null) {
  const map: Record<string, { bg: string; fg: string }> = {
    Occupied: { bg: "#fef2f2", fg: "#b91c1c" },
    Vacant: { bg: "#ecfdf5", fg: "#047857" },
    Blocked: { bg: "#f5f3ff", fg: "#6d28d9" },
  };
  const s = map[status ?? ""] ?? { bg: "#eef1f4", fg: "#5b6470" };
  return (
    <span className="chip" style={{ background: s.bg, color: s.fg }}>
      {status ?? "—"}
    </span>
  );
}

export default function RoomsTable({
  rows,
  branches,
  types,
  profile,
  showBranchTabs,
}: {
  rows: RoomRow[];
  branches: { code: string; name: string }[];
  types: AssetType[];
  profile: Profile;
  showBranchTabs: boolean;
}) {
  const [branch, setBranch] = useState("All");
  const [occ, setOcc] = useState("All");
  const [q, setQ] = useState("");
  const canAdd = profile.role !== "repair";

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (showBranchTabs && branch !== "All" && r.branch !== branch) return false;
      if (occ !== "All" && r.status !== occ) return false;
      if (query) {
        const hay = [r.room_number, r.branch, r.interior?.id, r.exterior?.id]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, branch, occ, q, showBranchTabs]);

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
                style={branch === b ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" } : undefined}
              >
                {b}
              </button>
            ))}
          </div>
        )}
        <select className="select" style={{ width: "auto" }} value={occ} onChange={(e) => setOcc(e.target.value)}>
          {OCC.map((o) => <option key={o} value={o}>{o === "All" ? "All occupancy" : o}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Filter by room, ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>{filtered.length} of {rows.length}</div>
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Branch</th><th>Room</th><th>Occupancy</th><th>Interior AC</th><th>Exterior AC</th>
              {canAdd && <th>Add</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={canAdd ? 6 : 5} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>No rooms match.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.branch}</td>
                <td style={{ fontWeight: 600 }}>{r.room_number}</td>
                <td>
                  {occChip(r.status)}
                  {r.status_note && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{r.status_note}</div>}
                </td>
                <td>
                  {r.interior ? (
                    <Link href={`/assets/${r.interior.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <div style={{ fontWeight: 600 }}>{r.interior.id}</div>
                      <StatusBadge status={r.interior.status} />
                    </Link>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>— none —</span>
                  )}
                </td>
                <td>
                  {r.exterior ? (
                    <Link href={`/assets/${r.exterior.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <div style={{ fontWeight: 600 }}>{r.exterior.id}</div>
                      <StatusBadge status={r.exterior.status} />
                    </Link>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>— none —</span>
                  )}
                </td>
                {canAdd && (
                  <td>
                    <AddAssetForm
                      branches={branches.map((b) => ({ code: b.code, name: b.name, sort: 0 }))}
                      profile={profile}
                      types={types}
                      defaultBranch={r.branch}
                      defaultRoom={r.room_number}
                      triggerLabel="+ Add AC"
                      triggerClassName="btn btn-sm"
                    />
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
