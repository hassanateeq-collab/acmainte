import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notify, branchInbox } from "@/lib/notify";
import { revalidateAll } from "@/lib/revalidate";
import { FIR_BRANCH, FIR_AC_DEPARTMENT, type FirIssue } from "@/lib/fir";

export const dynamic = "force-dynamic";

/**
 * Inbound webhook from the FIR portal. FIR's Supabase posts a `portal.issues`
 * row here on insert/update. We act only on AC (HVAC) issues: flag the matching
 * AC(s) in the reported branch + room and raise a notification. Secured by a
 * shared secret; de-duplicated via the `fir_links` table.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-fir-secret");
  if (!process.env.FIR_WEBHOOK_SECRET || secret !== process.env.FIR_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Supabase DB webhooks send { type, table, record, old_record }.
  const rec = ((payload as { record?: FirIssue })?.record ?? payload) as FirIssue;
  if (!rec?.id) return NextResponse.json({ ok: true, skipped: "no record" });
  if (rec.deleted) return NextResponse.json({ ok: true, skipped: "deleted" });

  // Only AC (HVAC) issues.
  if (String(rec.department_id ?? "") !== FIR_AC_DEPARTMENT) {
    return NextResponse.json({ ok: true, skipped: "not an AC issue" });
  }

  const code = FIR_BRANCH[String(rec.branch_id ?? "")];
  if (!code) return NextResponse.json({ ok: true, skipped: "unknown branch" });

  const room = String(rec.room_no ?? "").trim();
  const firNo = String(rec.fir_no ?? rec.id);
  const title = String(rec.title ?? "AC issue").slice(0, 300);

  const admin = supabaseAdmin();

  // Idempotency: only act the first time we see this FIR issue.
  const { error: linkErr } = await admin
    .from("fir_links")
    .insert({ fir_issue_id: rec.id, fir_no: firNo, branch: code, room_no: room || null });
  if (linkErr) {
    // Unique-violation = already processed (fine); anything else, surface it.
    if (String(linkErr.code) === "23505" || /duplicate/i.test(linkErr.message)) {
      return NextResponse.json({ ok: true, skipped: "already processed" });
    }
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  // Which AC(s) is this about? Match the FIR room/location — and, when those are
  // empty (Slack voice reports often are), the title/description text — against
  // the branch's asset rooms/areas (e.g. "517", "Reception", "Cafe").
  const { data: branchAssets } = await admin
    .from("assets")
    .select("id, room")
    .eq("current_branch", code);
  const roomed = ((branchAssets ?? []) as { id: string; room: string | null }[]).filter(
    (a) => a.room && a.room.trim().toLowerCase() !== "store"
  ) as { id: string; room: string }[];

  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const direct = new Set([norm(rec.room_no), norm(rec.location)].filter(Boolean));
  let matched = roomed.filter((a) => direct.has(norm(a.room)));
  if (matched.length === 0) {
    const text = `${rec.title ?? ""} ${rec.description ?? ""}`.toLowerCase();
    matched = roomed.filter((a) =>
      new RegExp(`(^|[^a-z0-9])${esc(norm(a.room))}([^a-z0-9]|$)`).test(text)
    );
  }

  const assetIds = matched.map((a) => a.id);
  for (const id of assetIds) {
    await admin
      .from("assets")
      .update({ open_issue: `AC issue (${firNo}): ${title}` })
      .eq("id", id);
    await admin.from("asset_events").insert({
      asset_id: id,
      kind: "issue",
      description: `AC issue reported from FIR ${firNo}: ${title}`,
      actor_name: "FIR portal",
    });
  }
  if (assetIds.length) {
    await admin.from("fir_links").update({ asset_ids: assetIds }).eq("fir_issue_id", rec.id);
  }

  const matchedRoom = matched.length ? matched[0].room : "";
  const where = room
    ? ` Room ${room}`
    : rec.location
    ? ` (${rec.location})`
    : matchedRoom
    ? ` ${matchedRoom}`
    : "";
  await notify(
    ["repair", ...branchInbox(code)],
    `AC issue in ${code}${where} — ${title} (${firNo})${assetIds.length ? "" : " · no matching AC on record"}`,
    { kind: "fir_issue", asset_id: assetIds[0] ?? null }
  );

  revalidateAll();
  return NextResponse.json({ ok: true, branch: code, room: room || null, assets: assetIds });
}
