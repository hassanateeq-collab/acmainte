"use server";

import { requireProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notify, branchInbox } from "@/lib/notify";
import { revalidateAll } from "@/lib/revalidate";
import type { Asset, Job } from "@/lib/types";
import type { ActionState } from "./assets";

function actorName(p: { full_name: string | null; email: string | null }) {
  return p.full_name || p.email || "Someone";
}
function rs(n: number) {
  return "Rs " + Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}
async function getAsset(id: string): Promise<Asset | null> {
  const { data } = await supabaseAdmin().from("assets").select("*").eq("id", id).maybeSingle();
  return (data as Asset) ?? null;
}
function canLog(role: string, branch: string | null, asset: Asset) {
  if (role === "admin" || role === "repair") return true;
  if (role === "branch_manager") return branch === asset.current_branch;
  return false;
}

/** Log a service or repair visit. Sets last-service, clears issue, returns from vendor. */
export async function logJobAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  const assetId = String(formData.get("asset_id") || "");
  const type = String(formData.get("type") || "Service");
  const date = String(formData.get("date") || "") || new Date().toISOString().slice(0, 10);
  const problem = String(formData.get("problem") || "").trim() || null;
  const work_done = String(formData.get("work_done") || "").trim() || null;
  const bill_amount = Number(formData.get("bill_amount")) || 0;
  const days_taken = Number(formData.get("days_taken")) || 0;

  if (!["Service", "Repair"].includes(type))
    return { error: "Choose Service or Repair." };

  const asset = await getAsset(assetId);
  if (!asset) return { error: "Asset not found." };
  if (!canLog(profile.role, profile.branch_code, asset))
    return { error: "You cannot log a job on this asset." };

  const admin = supabaseAdmin();
  const { error } = await admin.from("jobs").insert({
    asset_id: assetId,
    date,
    type,
    problem,
    work_done,
    bill_amount,
    days_taken,
    created_by: profile.id,
    created_by_name: actorName(profile),
  });
  if (error) return { error: error.message };

  // Saving a service/repair sets last service, clears the issue, marks returned.
  await admin
    .from("assets")
    .update({ last_service_date: date, open_issue: null, at_vendor: false })
    .eq("id", assetId);

  await notify(
    branchInbox(asset.current_branch),
    `${type} logged on ${assetId} — ${rs(bill_amount)}${
      asset.at_vendor ? " (returned from CoolTech)" : ""
    }`,
    { kind: "job_logged", asset_id: assetId }
  );
  revalidateAll();
  return { ok: true };
}

/** Add a charge — either onto an existing job, or as a standalone Charge line. */
export async function addChargeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (!(profile.role === "admin" || profile.role === "repair"))
    return { error: "Only Admin or CoolTech can add charges." };

  const assetId = String(formData.get("asset_id") || "");
  const jobId = String(formData.get("job_id") || "");
  const label = String(formData.get("label") || "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const date = String(formData.get("date") || "") || new Date().toISOString().slice(0, 10);
  if (!label) return { error: "Give the charge a label." };
  if (amount <= 0) return { error: "Enter an amount." };

  const admin = supabaseAdmin();

  if (jobId) {
    const { error } = await admin.from("job_charges").insert({
      job_id: jobId,
      label,
      amount,
      date,
      created_by_name: actorName(profile),
    });
    if (error) return { error: error.message };
    const { data: job } = await admin.from("jobs").select("asset_id").eq("id", jobId).maybeSingle();
    const aId = (job?.asset_id as string) || assetId;
    const asset = aId ? await getAsset(aId) : null;
    await notify(branchInbox(asset?.current_branch), `Charge added to a job on ${aId}: ${label} ${rs(amount)}`, {
      kind: "charge_added",
      asset_id: aId,
    });
  } else {
    if (!assetId) return { error: "Pick an asset for the standalone charge." };
    const asset = await getAsset(assetId);
    if (!asset) return { error: "Asset not found." };
    const { error } = await admin.from("jobs").insert({
      asset_id: assetId,
      date,
      type: "Charge",
      problem: label,
      bill_amount: amount,
      days_taken: 0,
      created_by: profile.id,
      created_by_name: actorName(profile),
    });
    if (error) return { error: error.message };
    await notify(branchInbox(asset.current_branch), `Standalone charge on ${assetId}: ${label} ${rs(amount)}`, {
      kind: "charge_added",
      asset_id: assetId,
    });
  }
  revalidateAll();
  return { ok: true };
}

export async function editJobAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (!(profile.role === "admin" || profile.role === "repair"))
    return { error: "Only Admin or CoolTech can edit a job." };

  const jobId = String(formData.get("job_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to edit a bill entry." };

  const admin = supabaseAdmin();
  const { data: existing } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!existing) return { error: "Job not found." };
  const job = existing as Job;

  const next = {
    date: String(formData.get("date") || job.date) || job.date,
    problem: String(formData.get("problem") || "").trim() || null,
    work_done: String(formData.get("work_done") || "").trim() || null,
    bill_amount: Number(formData.get("bill_amount")) || 0,
    days_taken: Number(formData.get("days_taken")) || 0,
  };

  const changes: string[] = [];
  if (Number(job.bill_amount) !== next.bill_amount)
    changes.push(`bill ${rs(Number(job.bill_amount))} → ${rs(next.bill_amount)}`);
  if (job.days_taken !== next.days_taken)
    changes.push(`days ${job.days_taken} → ${next.days_taken}`);
  if (job.date !== next.date) changes.push(`date ${job.date} → ${next.date}`);
  if ((job.problem || "") !== (next.problem || "")) changes.push("problem edited");
  if ((job.work_done || "") !== (next.work_done || "")) changes.push("work edited");

  await admin.from("jobs").update(next).eq("id", jobId);
  await admin.from("job_edits").insert({
    job_id: jobId,
    summary: changes.length ? changes.join(", ") : "no field changes",
    reason,
    edited_by_name: actorName(profile),
  });

  const asset = await getAsset(job.asset_id);
  await notify(branchInbox(asset?.current_branch), `Bill edited on ${job.asset_id}: ${changes.join(", ") || "details"} (${reason})`, {
    kind: "bill_edited",
    asset_id: job.asset_id,
  });
  revalidateAll();
  return { ok: true };
}

export async function deleteJobAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (!(profile.role === "admin" || profile.role === "repair"))
    return { error: "Only Admin or CoolTech can delete a job." };

  const jobId = String(formData.get("job_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to delete a bill entry." };

  const admin = supabaseAdmin();
  const { data: existing } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!existing) return { error: "Job not found." };
  const job = existing as Job;

  await admin.from("jobs").update({ deleted: true }).eq("id", jobId);
  await admin.from("job_edits").insert({
    job_id: jobId,
    summary: `Deleted ${job.type} of ${rs(Number(job.bill_amount))}`,
    reason,
    edited_by_name: actorName(profile),
  });
  const asset = await getAsset(job.asset_id);
  await notify(branchInbox(asset?.current_branch), `Bill deleted on ${job.asset_id}: ${job.type} ${rs(Number(job.bill_amount))} (${reason})`, {
    kind: "bill_deleted",
    asset_id: job.asset_id,
  });
  revalidateAll();
  return { ok: true };
}
