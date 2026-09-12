"use server";

import { requireProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidateAll } from "@/lib/revalidate";
import type { ActionState } from "./assets";

export async function createTypeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role !== "admin") return { error: "Only Admin can add asset types." };

  const code = String(formData.get("code") || "").trim().toUpperCase();
  const name = String(formData.get("name") || "").trim();
  const has_parts =
    ["on", "true", "1"].includes(String(formData.get("has_parts") || "").toLowerCase());

  if (!/^[A-Z0-9]{1,10}$/.test(code))
    return { error: "Code must be 1–10 letters/numbers, e.g. AC, GEN, FRIDGE." };
  if (!name) return { error: "Give the type a name." };

  const { error } = await supabaseAdmin()
    .from("asset_types")
    .upsert({ code, name, has_parts }, { onConflict: "code" });
  if (error)
    return {
      error: /relation .*asset_types.* does not exist/i.test(error.message)
        ? "The asset_types table isn't set up yet — run the one-time SQL from chat in Supabase first."
        : error.message,
    };
  revalidateAll();
  return { ok: true };
}

export async function deleteTypeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role !== "admin") return { error: "Only Admin can remove asset types." };
  const code = String(formData.get("code") || "").trim().toUpperCase();

  const { count } = await supabaseAdmin()
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("type", code);
  if ((count ?? 0) > 0)
    return { error: `Can't remove ${code}: ${count} asset(s) still use it.` };

  const { error } = await supabaseAdmin().from("asset_types").delete().eq("code", code);
  if (error) return { error: error.message };
  revalidateAll();
  return { ok: true };
}
