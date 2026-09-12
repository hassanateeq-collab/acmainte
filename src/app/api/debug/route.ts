import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Temporary diagnostic endpoint. Reports env presence + key roles, raw
 * connectivity from the server to Supabase, session status, and profile
 * lookup. Never returns secret values. Remove once things work.
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const out: Record<string, unknown> = {};

  out.env = {
    NEXT_PUBLIC_SUPABASE_URL: url || null,
    hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRole: !!service,
    anonKeyRole: roleOf(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceKeyRole: roleOf(service),
  };

  // 1) Raw connectivity: can the SERVER reach Supabase auth at all?
  try {
    const r = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
    });
    out.authHealth = { status: r.status, body: (await r.text()).slice(0, 200) };
  } catch (e) {
    out.authHealthError = String(e instanceof Error ? `${e.name}: ${e.message}` : e);
  }

  // 2) Raw REST call with the service key: is the key accepted + table present?
  try {
    const r = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
      },
    });
    out.restProfiles = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch (e) {
    out.restProfilesError = String(e instanceof Error ? `${e.name}: ${e.message}` : e);
  }

  // 3) Session via the SSR server client.
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    out.session = data.user ? { id: data.user.id, email: data.user.email } : null;
    if (error) out.getUserError = `${error.name}: ${error.message}`;
  } catch (e) {
    out.sessionError = String(e instanceof Error ? `${e.name}: ${e.message}` : e);
  }

  // 4) Profiles via the admin client.
  try {
    const admin = supabaseAdmin();
    const { count, error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    out.profilesTableCount = count;
    if (error)
      out.profilesTableError = JSON.stringify({
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
  } catch (e) {
    out.adminError = String(e instanceof Error ? `${e.name}: ${e.message}` : e);
  }

  return NextResponse.json(out, { status: 200 });
}
