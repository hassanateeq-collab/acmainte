import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Temporary diagnostic endpoint. Reports whether env vars are present, the
 * ROLE encoded in each key (to catch anon/service-role mix-ups), whether a
 * session cookie is readable, and whether the signed-in user has a profile.
 * Never returns secret values. Remove this route once things are working.
 */
function roleOf(jwt?: string): string | null {
  try {
    if (!jwt) return null;
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64").toString("utf8")
    );
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const out: Record<string, unknown> = {};

  out.env = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKeyRole: roleOf(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), // expect "anon"
    serviceKeyRole: roleOf(process.env.SUPABASE_SERVICE_ROLE_KEY), // expect "service_role"
  };

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    out.session = user ? { id: user.id, email: user.email } : null;
  } catch (e) {
    out.sessionError = String(e instanceof Error ? e.message : e);
  }

  try {
    const admin = supabaseAdmin();
    const { count, error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    out.profilesTableCount = count;
    if (error) out.profilesTableError = error.message;

    const session = out.session as { id: string } | null;
    if (session) {
      const { data, error: pe } = await admin
        .from("profiles")
        .select("*")
        .eq("id", session.id)
        .maybeSingle();
      out.myProfile = data ?? null;
      if (pe) out.myProfileError = pe.message;
    }
  } catch (e) {
    out.adminError = String(e instanceof Error ? e.message : e);
  }

  return NextResponse.json(out, { status: 200 });
}
