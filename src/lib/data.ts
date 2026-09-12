import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import type {
  Asset,
  AssetEvent,
  Branch,
  Job,
  JobCharge,
  JobEdit,
  Notification,
  Profile,
  Transfer,
} from "./types";

export async function listBranches(): Promise<Branch[]> {
  const { data } = await supabaseAdmin()
    .from("branches")
    .select("*")
    .order("sort");
  return (data as Branch[]) ?? [];
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
