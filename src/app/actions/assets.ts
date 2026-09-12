"use server";

import { requireProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownsAssetBranch, isAdmin } from "@/lib/perms";
import { notify, branchInbox } from "@/lib/notify";
import { revalidateAll } from "@/lib/revalidate";
import type { Asset } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean };

const PARTS = new Set(["I", "E"]);

function actorName(p: { full_name: string | null; email: string | null }) {
  return p.full_name || p.email || "Someone";
}

/** Build the next asset id for a (type, branch, part) combination. */
async function buildNextId(type: string, branch: string, part: string | null) {
  const q = supabaseAdmin()
    .from("assets")
    .select("seq")
    .eq("type", type)
    .eq("home_branch", branch);
  const { data } = part
    ? await q.eq("part", part).order("seq", { ascending: false }).limit(1)
    : await q.is("part", null).order("seq", { ascending: false }).limit(1);
  const seq = ((data?.[0]?.seq as number) ?? 0) + 1;
  const partSeg = part ? `-${part}` : "";
  const id = `${type}-${branch}${partSeg}-${String(seq).padStart(3, "0")}`;
  return { id, seq };
}

export async function createAssetAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role === "repair")
    return { error: "The repair company cannot add assets." };

  const type = (String(formData.get("type") || "AC")).toUpperCase().trim();
  const partRaw = String(formData.get("part") || "").toUpperCase().trim();
  const part = PARTS.has(partRaw) ? partRaw : null;
  const home_branch = String(formData.get("home_branch") || "").trim();
  const room = String(formData.get("room") || "").trim();
  const installed_date = String(formData.get("installed_date") || "") || null;
  const last_service_date =
    String(formData.get("last_service_date") || "") || null;
  const expected_life_years =
    Number(formData.get("expected_life_years")) || 10;
  const service_interval_days =
    Number(formData.get("service_interval_days")) || 90;

  if (!home_branch) return { error: "Choose the home branch." };
  if (type === "AC" && !part)
    return { error: "For an AC, choose interior (I) or exterior (E)." };
  if (
    profile.role === "branch_manager" &&
    profile.branch_code !== home_branch
  )
    return { error: "You can only add assets to your own branch." };

  // Retry a couple of times in case two adds race for the same sequence.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { id, seq } = await buildNextId(type, home_branch, part);
    const { error } = await supabaseAdmin()
      .from("assets")
      .insert({
        id,
        type,
        part,
        home_branch,
        current_branch: home_branch,
        room: room || "store",
        seq,
        installed_date,
        last_service_date,
        expected_life_years,
        service_interval_days,
      });
    if (!error) {
      await supabaseAdmin().from("asset_events").insert({
        asset_id: id,
        kind: "installed",
        description: `Registered at ${home_branch}${room ? `, room ${room}` : " (store)"}`,
        actor_name: actorName(profile),
      });
      await notify(
        branchInbox(home_branch),
        `New asset ${id} registered at ${home_branch}`,
        { kind: "asset_added", asset_id: id }
      );
      revalidateAll();
      return { ok: true };
    }
    if (!String(error.message).includes("duplicate")) {
      return { error: error.message };
    }
  }
  return { error: "Could not allocate an ID — please try again." };
}

export async function changePairingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role === "repair")
    return { error: "The repair company can view pairings but not change them." };

  const assetId = String(formData.get("asset_id") || "");
  const targetId = String(formData.get("target_id") || ""); // "" = keep as spare
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required." };

  const admin = supabaseAdmin();
  const { data: asset } = await admin
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { error: "Asset not found." };
  if (!ownsAssetBranch(profile, asset as Asset))
    return { error: "You can only change pairings for your branch." };

  const who = actorName(profile);
  const previous = (asset as Asset).paired_with;

  let target: Asset | null = null;
  if (targetId) {
    const { data } = await admin
      .from("assets")
      .select("*")
      .eq("id", targetId)
      .maybeSingle();
    target = (data as Asset) ?? null;
    if (!target) return { error: "Chosen part not found." };
    if (target.part === (asset as Asset).part)
      return { error: "Pair an interior with an exterior, not two of the same." };
  }

  // Break the previous link on both sides.
  const touched = new Set<string>([assetId]);
  if (previous) {
    await admin.from("assets").update({ paired_with: null }).eq("id", previous);
    touched.add(previous);
  }
  // If the target was paired to something else, break that too.
  if (target?.paired_with && target.paired_with !== assetId) {
    await admin
      .from("assets")
      .update({ paired_with: null })
      .eq("id", target.paired_with);
    touched.add(target.paired_with);
  }

  // Set the new link on both sides (or clear it).
  await admin.from("assets").update({ paired_with: targetId || null }).eq("id", assetId);
  touched.add(assetId);
  if (target) {
    await admin.from("assets").update({ paired_with: assetId }).eq("id", target.id);
    touched.add(target.id);
  }

  const desc = targetId
    ? `Pairing changed: ${previous ?? "nothing"} → ${targetId}. ${reason}`
    : `Unpaired (kept as spare): was ${previous ?? "nothing"}. ${reason}`;
  const events = [...touched].map((id) => ({
    asset_id: id,
    kind: "pairing",
    description: desc,
    actor_name: who,
  }));
  await admin.from("asset_events").insert(events);

  await notify([], `Pairing changed on ${assetId}: ${targetId || "spare"}`, {
    kind: "pairing",
    asset_id: assetId,
  });
  revalidateAll();
  return { ok: true };
}

export async function reportIssueAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role === "repair")
    return { error: "The repair company logs repairs, not issues." };

  const assetId = String(formData.get("asset_id") || "");
  const description = String(formData.get("description") || "").trim();
  if (!description) return { error: "Describe the issue." };

  const admin = supabaseAdmin();
  const { data: asset } = await admin
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { error: "Asset not found." };
  if (
    profile.role === "branch_manager" &&
    profile.branch_code !== (asset as Asset).current_branch
  )
    return { error: "You can only report issues for assets at your branch." };

  await admin.from("assets").update({ open_issue: description }).eq("id", assetId);
  await admin.from("asset_events").insert({
    asset_id: assetId,
    kind: "issue",
    description: `Issue reported: ${description}`,
    actor_name: actorName(profile),
  });
  await notify(
    ["repair", ...branchInbox((asset as Asset).current_branch)],
    `Issue reported on ${assetId}: ${description}`,
    { kind: "issue", asset_id: assetId }
  );
  revalidateAll();
  return { ok: true };
}

/** CoolTech "picks up" a unit for the workshop. */
export async function pickupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (!(profile.role === "repair" || isAdmin(profile)))
    return { error: "Only CoolTech (or Admin) can pick up a unit." };

  const assetId = String(formData.get("asset_id") || "");
  const admin = supabaseAdmin();
  const { data: asset } = await admin
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { error: "Asset not found." };

  await admin.from("assets").update({ at_vendor: true }).eq("id", assetId);
  await admin.from("asset_events").insert({
    asset_id: assetId,
    kind: "pickup",
    description: "Picked up by CoolTech for the workshop",
    actor_name: actorName(profile),
  });
  await notify(
    branchInbox((asset as Asset).current_branch),
    `${assetId} picked up by CoolTech`,
    { kind: "pickup", asset_id: assetId }
  );
  revalidateAll();
  return { ok: true };
}
