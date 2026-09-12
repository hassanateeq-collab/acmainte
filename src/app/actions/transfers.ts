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
  const to_room = String(formData.get("to_room") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!assetId || !to_branch) return { error: "Pick a part and a destination." };
  if (!to_room) return { error: "Say which room it should be installed in." };
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
    to_room,
    reason,
    status: "waiting",
    requested_by: profile.id,
    requested_by_name: actorName(profile),
  });
  if (error) return { error: error.message };

  await notify(
    branchInbox(from_branch),
    `Transfer requested: ${assetId} from ${from_branch} → ${to_branch} (Room ${to_room})`,
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
    // The part moves branches but is not installed yet — it sits in the store
    // and its spare label is cleared. CoolTech installs it into the room.
    await admin
      .from("assets")
      .update({ current_branch: transfer.to_branch, room: "store", is_spare: false })
      .eq("id", transfer.asset_id);
    await admin.from("asset_events").insert({
      asset_id: transfer.asset_id,
      kind: "moved",
      description: `Moved ${transfer.from_branch} → ${transfer.to_branch}${
        transfer.to_room ? `, to install in Room ${transfer.to_room}` : ""
      }${transfer.reason ? `. ${transfer.reason}` : ""}`,
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
      ["repair", ...branchInbox(transfer.to_branch)],
      `Transfer accepted: ${transfer.asset_id} → ${transfer.to_branch}. CoolTech to install in Room ${transfer.to_room ?? "?"}.`,
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

/** CoolTech confirms a moved part has been installed into its destination room. */
export async function markInstalledAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (!(profile.role === "repair" || profile.role === "admin"))
    return { error: "Only CoolTech (or Admin) can mark a unit installed." };

  const transferId = String(formData.get("transfer_id") || "");
  const admin = supabaseAdmin();
  const { data: t } = await admin
    .from("transfers")
    .select("*")
    .eq("id", transferId)
    .maybeSingle();
  if (!t) return { error: "Move record not found." };
  const transfer = t as Transfer;
  if (transfer.status !== "accepted")
    return { error: "This move hasn't been accepted yet." };
  if (transfer.installed) return { error: "Already marked installed." };

  const room = (transfer.to_room || "").trim() || "store";
  const who = actorName(profile);

  await admin
    .from("assets")
    .update({ room, is_spare: false })
    .eq("id", transfer.asset_id);

  const { error: markErr } = await admin
    .from("transfers")
    .update({
      installed: true,
      installed_by: profile.id,
      installed_by_name: who,
      installed_at: new Date().toISOString(),
    })
    .eq("id", transferId);
  if (markErr) {
    // Most common cause: the install/spare columns haven't been added to the
    // database yet — run supabase/migrations/2026_add_spare_and_install.sql.
    return {
      error: `Could not mark installed: ${markErr.message}. If this mentions a missing column, run the latest SQL migration on the database.`,
    };
  }

  await admin.from("asset_events").insert({
    asset_id: transfer.asset_id,
    kind: "installed",
    description: `Installed at ${transfer.to_branch}, Room ${room} by ${who}`,
    actor_name: who,
  });

  // Auto-pair with an unpaired opposite part already in that room.
  const { data: asset } = await admin
    .from("assets")
    .select("*")
    .eq("id", transfer.asset_id)
    .maybeSingle();
  const a = asset as Asset | null;
  if (a && a.part && room.toLowerCase() !== "store") {
    const opposite = a.part === "I" ? "E" : "I";
    const { data: mate } = await admin
      .from("assets")
      .select("id")
      .eq("current_branch", transfer.to_branch)
      .eq("room", room)
      .eq("part", opposite)
      .is("paired_with", null)
      .neq("id", a.id)
      .limit(1)
      .maybeSingle();
    if (mate?.id) {
      await admin.from("assets").update({ paired_with: mate.id }).eq("id", a.id);
      await admin.from("assets").update({ paired_with: a.id }).eq("id", mate.id);
      await admin.from("asset_events").insert([
        { asset_id: a.id, kind: "pairing", description: `Connected to ${mate.id} (Room ${room})`, actor_name: who },
        { asset_id: mate.id, kind: "pairing", description: `Connected to ${a.id} (Room ${room})`, actor_name: who },
      ]);
    }
  }

  await notify(
    branchInbox(transfer.to_branch),
    `${transfer.asset_id} installed in Room ${room} at ${transfer.to_branch}`,
    { kind: "installed", asset_id: transfer.asset_id }
  );
  revalidateAll();
  return { ok: true };
}

/** Send an asset back to its home branch. Admin or the current branch manager. */
export async function moveBackAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role === "repair")
    return { error: "The repair company cannot move parts back." };

  const assetId = String(formData.get("asset_id") || "");
  const admin = supabaseAdmin();
  const { data: asset } = await admin
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { error: "Asset not found." };
  const a = asset as Asset;

  const canMove =
    profile.role === "admin" ||
    (profile.role === "branch_manager" && profile.branch_code === a.current_branch);
  if (!canMove)
    return { error: "Only Admin or the branch currently holding it can move it back." };
  if (a.current_branch === a.home_branch)
    return { error: "This part is already at its home branch." };

  const who = actorName(profile);
  const now = new Date().toISOString();
  const from = a.current_branch;
  const to = a.home_branch;

  // Break any pairing on both sides — it's leaving the room.
  if (a.paired_with) {
    await admin.from("assets").update({ paired_with: null }).eq("id", a.paired_with);
  }
  await admin
    .from("assets")
    .update({ current_branch: to, room: "store", is_spare: false, paired_with: null })
    .eq("id", assetId);

  // Record it as a completed move so the repair team's history stays whole.
  await admin.from("transfers").insert({
    asset_id: assetId,
    from_branch: from,
    to_branch: to,
    reason: "Returned to home branch",
    status: "accepted",
    requested_by: profile.id,
    requested_by_name: who,
    decided_by: profile.id,
    decided_by_name: who,
    decided_at: now,
    installed: true,
    installed_by: profile.id,
    installed_by_name: who,
    installed_at: now,
  });

  await admin.from("asset_events").insert({
    asset_id: assetId,
    kind: "moved",
    description: `Moved back to home branch ${to} (from ${from})`,
    actor_name: who,
  });

  await notify(
    ["repair", ...branchInbox(to)],
    `${assetId} moved back to its home branch ${to}`,
    { kind: "moved_back", asset_id: assetId }
  );
  revalidateAll();
  return { ok: true };
}
