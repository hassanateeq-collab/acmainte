"use server";

import { requireProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { audiencesFor } from "@/lib/perms";
import { revalidateAll } from "@/lib/revalidate";

export async function markAllReadAction() {
  const profile = await requireProfile();
  const audiences = audiencesFor(profile);
  if (audiences.length === 0) return;
  await supabaseAdmin()
    .from("notifications")
    .update({ read: true })
    .in("audience", audiences)
    .eq("read", false);
  revalidateAll();
}
