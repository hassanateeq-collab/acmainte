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

// Maintenance-portal branch code -> PMS business_units.property_id
const BRANCH_PROPERTY: Record<string, string> = {
  FSL: "6fcdcc05-3767-46a9-a6b1-396fad7b26ef",
  EXT: "539dc430-84c8-4d3e-942d-33ad0ffc3bc9",
  CLF: "bfa1f6f3-57bf-4add-b3b4-2aaff835e427",
  DHA: "4354c02c-c816-424c-946b-7d5781bc6dd1",
};
const PROPERTY_BRANCH: Record<string, string> = Object.fromEntries(
  Object.entries(BRANCH_PROPERTY).map(([b, p]) => [p, b])
);

export function pmsEnabled(): boolean {
  return !!(process.env.PMS_SUPABASE_URL && process.env.PMS_SUPABASE_KEY);
}

function pms() {
  const url = process.env.PMS_SUPABASE_URL;
  const key = process.env.PMS_SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Today's business date in the hotel's timezone (Pakistan, UTC+5). */
function hotelToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

/** branch code -> (PMS room_number -> state) */
export type OccupancyMap = Record<string, Record<string, RoomState>>;

type RoomRow = { id: string; room_number: string; property_id: string };
type BookingRow = { room_id: string; status: string | null; checkin_status: string | null };

/**
 * Fetch tonight's occupancy for every branch in one pass. Cached per request.
 * A room is Occupied when a live booking (confirmed or checked-in) covers
 * tonight, Blocked when a block covers it, otherwise Vacant. No-shows,
 * cancellations and checkouts are ignored.
 */
export const getAllOccupancy = cache(async function getAllOccupancy(): Promise<OccupancyMap> {
  const out: OccupancyMap = { FSL: {}, EXT: {}, CLF: {}, DHA: {} };
  const db = pms();
  if (!db) return out;

  const propIds = Object.values(BRANCH_PROPERTY);
  const { data: rooms, error } = await db
    .from("rooms")
    .select("id,room_number,property_id")
    .in("property_id", propIds)
    .eq("is_active", true);
  if (error || !rooms) return out;

  const roomById = new Map<string, RoomRow>();
  for (const r of rooms as RoomRow[]) {
    roomById.set(r.id, r);
    const branch = PROPERTY_BRANCH[r.property_id];
    if (branch) out[branch][String(r.room_number)] = "Vacant";
  }

  const today = hotelToday();
  const roomIds = (rooms as RoomRow[]).map((r) => r.id);
  const { data: bookings } = await db
    .from("bookings")
    .select("room_id,status,checkin_status")
    .in("room_id", roomIds)
    .lte("check_in", today)
    .gt("check_out", today);

  for (const b of (bookings as BookingRow[]) ?? []) {
    const r = roomById.get(b.room_id);
    if (!r) continue;
    const branch = PROPERTY_BRANCH[r.property_id];
    if (!branch) continue;
    const st = String(b.status ?? "").toUpperCase();
    const cin = String(b.checkin_status ?? "").toUpperCase();
    if (["CANCELLED", "CHECKED_OUT", "NO_SHOW"].includes(st)) continue;
    const key = String(r.room_number);
    const cur = out[branch][key];
    if (cin === "CHECKED_IN" || st === "CONFIRMED") {
      out[branch][key] = "Occupied";
    } else if (st === "BLOCKED" && cur !== "Occupied") {
      out[branch][key] = "Blocked";
    }
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
