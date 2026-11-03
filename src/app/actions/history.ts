"use server";

import { requireProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidateAll } from "@/lib/revalidate";
import type { ActionState } from "./assets";

/**
 * Remove a FIR history entry (e.g. one that was rejected in FIR before the
 * webhook handled rejections). Admin only. Also clears the open-issue flag on
 * any AC it was still pointing at.
 */
export async function removeFirHistoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role !== "admin")
    return { error: "Only Admin can remove history entries." };

  const id = String(formData.get("fir_issue_id") || "").trim();
  if (!id) return { error: "No entry id." };

  const admin = supabaseAdmin();
  const { data: link } = await admin
    .from("fir_links")
    .select("asset_ids")
    .eq("fir_issue_id", id)
    .maybeSingle();

  for (const assetId of ((link?.asset_ids ?? []) as string[]).filter(Boolean)) {
    await admin.from("assets").update({ open_issue: null }).eq("id", assetId);
  }

  await admin.from("fir_links").delete().eq("fir_issue_id", id);
  revalidateAll();
  return { ok: true };
}
