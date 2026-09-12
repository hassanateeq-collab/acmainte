import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import type { Profile } from "./types";

/**
 * Returns the signed-in user's profile, or null if not signed in.
 * The auth session is read via the cookie-bound client; the profile row is
 * fetched with the service-role client (RLS is locked to the browser).
 *
 * Wrapped in React `cache()` so it runs at most once per request even though
 * the layout and every page call it. Without this, many concurrent
 * `auth.getUser()` calls could each try to refresh the (rotating) Supabase
 * token in the same request; since a Server Component can't persist the new
 * cookie, that raced the refresh token stale and logged the user out. One
 * shared call per request avoids that.
 */
export const getCurrentProfile = cache(async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) {
    // Auth user exists but no profile row yet — create a fallback.
    const isFirst =
      (await admin.from("profiles").select("id", { count: "exact", head: true }))
        .count === 0;
    const { data: created } = await admin
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.email?.split("@")[0] ?? "User",
        role: isFirst ? "admin" : "branch_manager",
      })
      .select("*")
      .single();
    return (created as Profile) ?? null;
  }
  return data as Profile;
});

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}
