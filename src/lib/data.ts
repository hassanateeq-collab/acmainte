import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import type {
  Asset,
  AssetEvent,
  AssetType,
  Branch,
  Job,
  JobCharge,
  JobEdit,
  Notification,
  Profile,
  Room,
  Transfer,
} from "./types";

/** Persistent rooms list. Returns [] if the rooms table isn't created yet. */
export async function listRooms(): Promise<Room[]> {
  const { data, error } = await supabaseAdmin()
    .from("rooms")
    .select("*")
    .order("branch_code")
    .order("sort")
    .order("room_number");
  if (error || !data) return [];
  return data as Room[];
}

export async function listBranches(): Promise<Branch[]> {
  const { data } = await supabaseAdmin()
    .from("branches")
    .select("*")
    .order("sort");
  return (data as Branch[]) ?? [];
}

const DEFAULT_TYPES: AssetType[] = [
  { code: "AC", name: "Air conditioner", has_parts: true, sort: 1 },
];

/** Asset types (admin-managed). Falls back to a default AC type if the
 *  asset_types table hasn't been created yet. */
export async function listAssetTypes(): Promise<AssetType[]> {
  const { data, error } = await supabaseAdmin()
    .from("asset_types")
    .select("*")
    .order("sort")
    .order("name");
  if (error || !data || data.length === 0) return DEFAULT_TYPES;
  return data as AssetType[];
}

export async function listAssets(): Promise<Asset[]> {
  const { data } = await supabaseAdmin()
    .from("assets")
    .select("*")
    .order("id");
  return (data as Asset[]) ?? [];
}

export async function getAsset(id: string): Promise<Asset | null> {
  const { data } = await supabaseAdmin()
    .from("assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Asset) ?? null;
}

export async function listAssetEvents(assetId: string): Promise<AssetEvent[]> {
  const { data } = await supabaseAdmin()
    .from("asset_events")
    .select("*")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });
  return (data as AssetEvent[]) ?? [];
}

export type JobWithExtras = Job & {
  job_charges: JobCharge[];
  job_edits: JobEdit[];
};

export async function listJobsForAsset(assetId: string): Promise<JobWithExtras[]> {
  const { data } = await supabaseAdmin()
    .from("jobs")
    .select("*, job_charges(*), job_edits(*)")
    .eq("asset_id", assetId)
    .eq("deleted", false)
    .order("date", { ascending: false });
  return (data as JobWithExtras[]) ?? [];
}

export async function listAllJobs(): Promise<JobWithExtras[]> {
  const { data } = await supabaseAdmin()
    .from("jobs")
    .select("*, job_charges(*), job_edits(*)")
    .eq("deleted", false)
    .order("date", { ascending: false });
  return (data as JobWithExtras[]) ?? [];
}

export async function listTransfers(): Promise<Transfer[]> {
  const { data } = await supabaseAdmin()
    .from("transfers")
    .select("*")
    .order("requested_at", { ascending: false });
  return (data as Transfer[]) ?? [];
}

export async function listNotifications(
  audiences: string[]
): Promise<Notification[]> {
  if (audiences.length === 0) return [];
  const { data } = await supabaseAdmin()
    .from("notifications")
    .select("*")
    .in("audience", audiences)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as Notification[]) ?? [];
}

export async function unreadCount(audiences: string[]): Promise<number> {
  if (audiences.length === 0) return 0;
  const { count } = await supabaseAdmin()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .in("audience", audiences)
    .eq("read", false);
  return count ?? 0;
}

export type JobEditRow = JobEdit & {
  jobs: { asset_id: string; type: string } | null;
};

/** Full money change log (edits + deletes) for the Admin audit trail. */
export async function listJobEdits(): Promise<JobEditRow[]> {
  const { data } = await supabaseAdmin()
    .from("job_edits")
    .select("*, jobs(asset_id, type)")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data as JobEditRow[]) ?? [];
}

export async function listProfiles(): Promise<Profile[]> {
  const { data } = await supabaseAdmin()
    .from("profiles")
    .select("*")
    .order("created_at");
  return (data as Profile[]) ?? [];
}

/** Total money on a job = bill + additional charges. */
export function jobTotal(job: JobWithExtras): number {
  const extras = (job.job_charges ?? []).reduce(
    (s, c) => s + Number(c.amount || 0),
    0
  );
  return Number(job.bill_amount || 0) + extras;
}
