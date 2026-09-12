"use server";

import { requireProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notify, branchInbox } from "@/lib/notify";
import { revalidateAll } from "@/lib/revalidate";
import type { Asset, Transfer } from "@/lib/types";
import type { ActionState } from "./assets";

function actorName(p: { full_name: string | null; email: string | null }) {
  return p.full_name || p.email || "Someone";
}

export async function requestTransferAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role === "repair")
    return { error: "The repair company cannot request transfers." };

  const assetId = String(formData.get("asset_id") || "");
  const to_branch = String(formData.get("to_branch") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!assetId || !to_branch) return { error: "Pick a part and a destination." };
  if (!reason) return { error: "Give a reason for the request." };

  const admin = supabaseAdmin();
  const { data: asset } = await admin
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { error: "Asset not found." };
  const from_branch = (asset as Asset).current_branch;
  if (from_branch === to_branch)
    return { error: "That part is already at the destination branch." };
  if (
    profile.role === "branch_manager" &&
    profile.branch_code !== to_branch
  )
    return { error: "A branch manager can only request parts into their own branch." };

  const { error } = await admin.from("transfers").insert({
    asset_id: assetId,
    from_branch,
    to_branch,
    reason,
    status: "waiting",
    requested_by: profile.id,
    requested_by_name: actorName(profile),
  });
  if (error) return { error: error.message };

  await notify(
    branchInbox(from_branch),
    `Transfer requested: ${assetId} from ${from_branch} → ${to_branch}`,
    { kind: "transfer_requested", asset_id: assetId }
  );
  revalidateAll();
  return { ok: true };
}

export async function decideTransferAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  const transferId = String(formData.get("transfer_id") || "");
  const decision = String(formData.get("decision") || "");
  if (!["accept", "decline"].includes(decision))
    return { error: "Invalid decision." };

  const admin = supabaseAdmin();
  const { data: t } = await admin
    .from("transfers")
    .select("*")
    .eq("id", transferId)
    .maybeSingle();
  if (!t) return { error: "Transfer not found." };
  const transfer = t as Transfer;
  if (transfer.status !== "waiting")
    return { error: "This transfer has already been decided." };

  const canDecide =
    profile.role === "admin" ||
    (profile.role === "branch_manager" &&
      profile.branch_code === transfer.from_branch);
  if (!canDecide)
    return { error: "Only the owning branch (or Admin) can decide this." };

  const who = actorName(profile);
  const now = new Date().toISOString();

  if (decision === "accept") {
    await admin
      .from("assets")
      .update({ current_branch: transfer.to_branch })
      .eq("id", transfer.asset_id);
    await admin.from("asset_events").insert({
      asset_id: transfer.asset_id,
      kind: "moved",
      description: `Moved ${transfer.from_branch} → ${transfer.to_branch}${
        transfer.reason ? `. ${transfer.reason}` : ""
      }`,
      actor_name: who,
    });
    await admin
      .from("transfers")
      .update({
        status: "accepted",
        decided_by: profile.id,
        decided_by_name: who,
        decided_at: now,
      })
      .eq("id", transferId);
    await notify(
      branchInbox(transfer.to_branch),
      `Transfer accepted: ${transfer.asset_id} moved to ${transfer.to_branch}`,
      { kind: "transfer_accepted", asset_id: transfer.asset_id }
    );
  } else {
    await admin
      .from("transfers")
      .update({
        status: "declined",
        decided_by: profile.id,
        decided_by_name: who,
        decided_at: now,
      })
      .eq("id", transferId);
    await notify(
      branchInbox(transfer.to_branch),
      `Transfer declined: ${transfer.asset_id} stays at ${transfer.from_branch}`,
      { kind: "transfer_declined", asset_id: transfer.asset_id }
    );
  }
  revalidateAll();
  return { ok: true };
}
