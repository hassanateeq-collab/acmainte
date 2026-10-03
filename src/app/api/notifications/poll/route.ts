import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { audiencesFor } from "@/lib/perms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Lightweight live-notification poll. The notification bell polls this every
 * few seconds; when `latestId` changes it means a new item arrived, and the
 * client rings a tone + refreshes the page so the badge and lists update
 * without a manual reload. Auth is the signed-in session cookie.
 */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ count: 0, latestId: null, signedIn: false });
  }

  const audiences = audiencesFor(profile);
  if (audiences.length === 0) {
    return NextResponse.json({ count: 0, latestId: null, signedIn: true });
  }

  const admin = supabaseAdmin();

  // Newest notification for this inbox (any read state) — used as the change
  // marker so the client only rings when something genuinely new appears.
  const { data: latest } = await admin
    .from("notifications")
    .select("id, message, asset_id")
    .in("audience", audiences)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Unread count for the sidebar badge.
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .in("audience", audiences)
    .eq("read", false);

  return NextResponse.json({
    count: count ?? 0,
    latestId: latest?.id ?? null,
    latestMessage: latest?.message ?? null,
    assetId: latest?.asset_id ?? null,
    signedIn: true,
  });
}
