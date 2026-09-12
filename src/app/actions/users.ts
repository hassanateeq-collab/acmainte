"use server";

import { requireProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidateAll } from "@/lib/revalidate";
import type { ActionState } from "./assets";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "branch_manager", "repair"];

export async function createUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role !== "admin") return { error: "Only Admin can add people." };

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const full_name = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "") as Role;
  const branch_code = String(formData.get("branch_code") || "").trim() || null;

  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  if (role === "branch_manager" && !branch_code)
    return { error: "A branch manager needs a branch." };

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, branch_code },
  });
  if (error) return { error: error.message };

  // Ensure the profile reflects the chosen role/branch (trigger may have run
  // with defaults if it fired before metadata was read).
  if (data.user) {
    await admin
      .from("profiles")
      .upsert({
        id: data.user.id,
        email,
        full_name: full_name || email.split("@")[0],
        role,
        branch_code: role === "branch_manager" ? branch_code : null,
      });
  }
  revalidateAll();
  return { ok: true };
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role !== "admin") return { error: "Only Admin can change roles." };

  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "") as Role;
  const branch_code = String(formData.get("branch_code") || "").trim() || null;
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  if (role === "branch_manager" && !branch_code)
    return { error: "A branch manager needs a branch." };

  await supabaseAdmin()
    .from("profiles")
    .update({ role, branch_code: role === "branch_manager" ? branch_code : null })
    .eq("id", id);
  revalidateAll();
  return { ok: true };
}

export async function deleteUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role !== "admin") return { error: "Only Admin can remove people." };
  const id = String(formData.get("id") || "");
  if (id === profile.id) return { error: "You cannot remove your own account." };

  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };
  await admin.from("profiles").delete().eq("id", id);
  revalidateAll();
  return { ok: true };
}
