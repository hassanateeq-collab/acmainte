import type { Asset } from "./types";

export type AssetRow = {
  key: string;
  branch: string;
  room: string | null;
  interior: Asset | null;
  exterior: Asset | null;
  swapped: boolean;
};

/** Exterior is "swapped" when it isn't the one the interior was installed with. */
export function isSwapped(interior: Asset, exterior: Asset): boolean {
  return !(
    interior.home_branch === exterior.home_branch &&
    interior.seq === exterior.seq
  );
}

/**
 * One row per interior with its paired exterior beside it. Exteriors paired to
 * nothing get their own rows. Non-AC assets (no part) get their own rows.
 */
export function buildAssetRows(assets: Asset[]): AssetRow[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const usedExterior = new Set<string>();
  const rows: AssetRow[] = [];

  for (const a of assets) {
    if (a.part === "I") {
      const ext =
        a.paired_with && byId.get(a.paired_with)?.part === "E"
          ? byId.get(a.paired_with)!
          : null;
      if (ext) usedExterior.add(ext.id);
      rows.push({
        key: a.id,
        branch: a.current_branch,
        room: a.room,
        interior: a,
        exterior: ext,
        swapped: ext ? isSwapped(a, ext) : false,
      });
    } else if (a.part === null) {
      rows.push({
        key: a.id,
        branch: a.current_branch,
        room: a.room,
        interior: a,
        exterior: null,
        swapped: false,
      });
    }
  }

  for (const a of assets) {
    if (a.part === "E" && !usedExterior.has(a.id)) {
      rows.push({
        key: a.id,
        branch: a.current_branch,
        room: a.room,
        interior: null,
        exterior: a,
        swapped: false,
      });
    }
  }

  return rows;
}

/** Mock room occupancy (real data will come from the PMS later — see spec §11). */
export function mockOccupancy(room: string | null): string {
  if (!room || room.toLowerCase() === "store") return "Store";
  let h = 0;
  for (const ch of room) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 3 === 0 ? "Vacant" : "Occupied";
}
