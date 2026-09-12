import { requireProfile } from "@/lib/auth";
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

  const find = (br: string, room: string, part: "I" | "E"): Asset | null =>
    assets.find(
      (a) => a.current_branch === br && (a.room ?? "") === room && a.part === part
    ) ?? null;

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
    </div>
  );
}
