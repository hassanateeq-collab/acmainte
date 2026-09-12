import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Temporary diagnostic endpoint. Tests whether the CLIENT key (publishable /
 * anon) and the SERVER key (secret / service_role) are accepted by Supabase,
 * and prints a plain-English verdict. Never returns secret values.
 */
async function testKey(url: string, key: string) {
  try {
    const r = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const body = (await r.text()).slice(0, 200);
    return { status: r.status, ok: r.status >= 200 && r.status < 300, body };
  } catch (e) {
    return { status: 0, ok: false, body: String(e instanceof Error ? e.message : e) };
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const clientKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const client = await testKey(url, clientKey);
  const server = await testKey(url, serverKey);

  let session: unknown = null;
  let sessionNote = "";
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    session = data.user ? { id: data.user.id, email: data.user.email } : null;
    if (!data.user) sessionNote = "no active login cookie (expected if you haven't signed in this browser)";
  } catch (e) {
    sessionNote = String(e instanceof Error ? e.message : e);
  }

  const clientFmt = clientKey.startsWith("sb_") ? "new (sb_)" : clientKey.startsWith("ey") ? "legacy JWT (eyJ)" : "unknown/empty";
  const serverFmt = serverKey.startsWith("sb_") ? "new (sb_)" : serverKey.startsWith("ey") ? "legacy JWT (eyJ)" : "unknown/empty";

  let verdict: string;
  if (client.ok && server.ok) {
    verdict = "✅ BOTH KEYS WORK. If login still bounces, the issue is the user/profile, not the keys.";
  } else if (!client.ok && !server.ok) {
    verdict = "❌ BOTH keys are REJECTED by Supabase. Update BOTH keys in .env.local, then restart the dev server.";
  } else if (!client.ok) {
    verdict = "❌ The CLIENT key (NEXT_PUBLIC_SUPABASE_ANON_KEY) is REJECTED — that's why sign-in fails. Set it to your sb_publishable_ key.";
  } else {
    verdict = "❌ The SERVER key (SUPABASE_SERVICE_ROLE_KEY) is REJECTED. Set it to your sb_secret_ key.";
  }

  return NextResponse.json(
    {
      verdict,
      clientKey: { format: clientFmt, accepted: client.ok, httpStatus: client.status, response: client.body },
      serverKey: { format: serverFmt, accepted: server.ok, httpStatus: server.status, response: server.body },
      supabaseUrl: url,
      session,
      sessionNote,
      reminder: "After editing .env.local you MUST stop (Ctrl+C) and re-run `npm run dev` — env vars load only at startup.",
    },
    { status: 200 }
  );
}
