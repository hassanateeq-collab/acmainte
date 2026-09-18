import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * Live room occupancy, read from the Hamsun-PMS database.
 *
 * Enabled only when PMS_SUPABASE_URL + PMS_SUPABASE_KEY are set in the
 * environment (a server-side, read-capable key for the PMS project). When they
 * are absent the whole feature is a no-op and callers fall back to "Unknown".
 */

export type RoomState = "Occupied" | "Vacant" | "Blocked" | "Unknown";

export function pmsEnabled(): boolean {
  return !!(process.env.PMS_SUPABASE_URL && process.env.PMS_SUPABASE_KEY);
}

function pms() {
  const url = process.env.PMS_SUPABASE_URL;
  const key = process.env.PMS_SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** branch code -> (PMS room_number -> state) */
export type OccupancyMap = Record<string, Record<string, RoomState>>;

type OccRow = { branch_code: string; room_number: string; state: string };

/**
 * Tonight's occupancy for every branch, read from the sanitized
 * `portal_room_occupancy` view in the PMS (branch + room + state only —
 * no guest data). Cached per request. Returns an empty map when the PMS
 * env vars aren't set, so callers fall back to "Unknown".
 */
export const getAllOccupancy = cache(async function getAllOccupancy(): Promise<OccupancyMap> {
  const out: OccupancyMap = { FSL: {}, EXT: {}, CLF: {}, DHA: {} };
  const db = pms();
  if (!db) return out;

  const { data, error } = await db
    .from("portal_room_occupancy")
    .select("branch_code,room_number,state");
  if (error || !data) return out;

  for (const row of data as OccRow[]) {
    const branch = out[row.branch_code];
    if (branch) branch[String(row.room_number)] = row.state as RoomState;
  }
  return out;
});

/** Human label for a room state ("Unknown" shows as an em dash). */
export function occText(state: RoomState): string {
  return state === "Unknown" ? "—" : state;
}

/** Candidate PMS room keys for a portal room number (handles DHA's A/B/C codes). */
function pmsCandidates(room: string): string[] {
  const c = [room, room.toUpperCase()];
  // DHA: hotel numbers 101..404 map to A1..D4 (floor digit -> A/B/C/D, unit digit).
  const m = room.match(/^([1-4])0?([1-9])$/);
  if (m) {
    const letter = "ABCD"[Number(m[1]) - 1];
    if (letter) c.push(`${letter}${m[2]}`);
  }
  return c;
}

/** Resolve one portal room to its live PMS state. */
export function roomState(
  occ: OccupancyMap,
  branch: string | null | undefined,
  portalRoom: string | null | undefined
): RoomState {
  if (!branch || !portalRoom) return "Unknown";
  const room = String(portalRoom).trim();
  if (!room || room.toLowerCase() === "store") return "Unknown";
  const branchMap = occ[branch];
  if (!branchMap) return "Unknown";
  for (const k of pmsCandidates(room)) {
    if (branchMap[k] !== undefined) return branchMap[k];
  }
  return "Unknown";
}
