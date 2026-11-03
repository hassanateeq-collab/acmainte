import { requireProfile } from "@/lib/auth";
import Link from "next/link";
import { listRooms, listAssets, listBranches, listAssetTypes } from "@/lib/data";
import { assetStatus } from "@/lib/status";
import PageHeader from "@/components/PageHeader";
import RoomsTable, { type RoomRow } from "@/components/RoomsTable";
import type { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const profile = await requireProfile();
  const [rooms, assets, branches, types] = await Promise.all([
    listRooms(),
    listAssets(),
    listBranches(),
    listAssetTypes(),
  ]);

  if (rooms.length === 0) {
    return (
      <div>
        <PageHeader title="Rooms" subtitle="Every room and its occupancy." />
        <div className="card" style={{ padding: 24, color: "var(--muted)" }}>
          No rooms yet. Run the <strong>rooms_setup.sql</strong> in Supabase to
          load your room list, then refresh.
        </div>
      </div>
    );
  }

  const inScope =
    profile.role === "branch_manager"
      ? rooms.filter((r) => r.branch_code === profile.branch_code)
      : rooms;

  // Match an AC to a room tolerantly. Beyond case/space/leading-zero, DHA
  // rooms are letter-coded (A1..D4) while the AC may hold the hotel number
  // (101..404) — or vice-versa — so we bridge both directions there.
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const roomKeys = (branch: string, s: unknown): Set<string> => {
    const n = norm(s);
    const keys = new Set<string>();
    if (!n) return keys;
    keys.add(n);
    // Pure number with optional trailing letter: drop leading zeros ("02"->"2").
    const num = n.match(/^0*(\d+)([a-z]?)$/);
    if (num) keys.add(num[1] + num[2]);
    if (branch === "DHA") {
      // hotel number -> letter code: 101 -> a1, 209 -> b9
      const toLetter = n.match(/^([1-4])0?([1-9])$/);
      if (toLetter) keys.add("abcd"[Number(toLetter[1]) - 1] + toLetter[2]);
      // letter code -> hotel number: a1 -> a1 (kept) and 101
      const toNum = n.match(/^([a-d])0?([1-9])$/);
      if (toNum) {
        const floor = "abcd".indexOf(toNum[1]) + 1;
        keys.add(`${floor}0${toNum[2]}`);
        keys.add(`${floor}${toNum[2]}`);
      }
    }
    return keys;
  };
  const sameRoom = (branch: string, a: unknown, b: unknown) => {
    const ka = roomKeys(branch, a);
    for (const k of roomKeys(branch, b)) if (ka.has(k)) return true;
    return false;
  };

  const matched = new Set<string>();
  const find = (br: string, room: string, part: "I" | "E"): Asset | null => {
    const hit = assets.find(
      (a) => a.current_branch === br && a.part === part && sameRoom(br, a.room, room)
    );
    if (hit) matched.add(hit.id);
    return hit ?? null;
  };

  const rows: RoomRow[] = inScope.map((r) => {
    const i = find(r.branch_code, r.room_number, "I");
    const e = find(r.branch_code, r.room_number, "E");
    return {
      id: r.id,
      branch: r.branch_code,
      room_number: r.room_number,
      status: r.status,
      status_note: r.status_note,
      interior: i ? { id: i.id, status: assetStatus(i) } : null,
      exterior: e ? { id: e.id, status: assetStatus(e) } : null,
    };
  });

  // ACs that sit in a real room but matched no room record above — the room
  // string on the AC doesn't line up with any room in the rooms table. These
  // are exactly the "I added it but don't see it" units.
  const scopeBranches = new Set(inScope.map((r) => r.branch_code));
  const unplaced = assets
    .filter(
      (a) =>
        scopeBranches.has(a.current_branch) &&
        !matched.has(a.id) &&
        a.room &&
        a.room.trim().toLowerCase() !== "store"
    )
    .sort((a, b) => a.current_branch.localeCompare(b.current_branch) || a.id.localeCompare(b.id));

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle="Every room with its occupancy. Add the interior/exterior AC to any room — the room stays here even before its ACs are added."
      />
      <RoomsTable
        rows={rows}
        branches={branches.map((b) => ({ code: b.code, name: b.name }))}
        types={types}
        profile={profile}
        showBranchTabs={profile.role !== "branch_manager"}
      />

      {unplaced.length > 0 && (
        <div className="card" style={{ marginTop: 20, padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            ACs not shown above ({unplaced.length})
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            These ACs have a room that doesn&apos;t match any room in the rooms list,
            so they can&apos;t be placed. Fix either the AC&apos;s room or the room record
            (same spelling) and they&apos;ll appear. Usually the room is missing from{" "}
            <strong>rooms_setup.sql</strong>, or the room number is written differently.
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>AC</th>
                  <th>Part</th>
                  <th>Room on the AC</th>
                </tr>
              </thead>
              <tbody>
                {unplaced.map((a) => (
                  <tr key={a.id}>
                    <td>{a.current_branch}</td>
                    <td>
                      <Link href={`/assets/${a.id}`} style={{ fontWeight: 600, color: "var(--brand-ink)" }}>
                        {a.id}
                      </Link>
                    </td>
                    <td>{a.part === "I" ? "Interior" : a.part === "E" ? "Exterior" : "—"}</td>
                    <td>
                      <code style={{ background: "#f6f7f9", padding: "1px 6px", borderRadius: 5 }}>
                        {a.room || "—"}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
