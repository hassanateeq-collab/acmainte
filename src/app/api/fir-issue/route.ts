import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notify, branchInbox } from "@/lib/notify";
import { revalidateAll } from "@/lib/revalidate";
import { FIR_BRANCH, FIR_AC_DEPARTMENT, firIsDone, type FirIssue } from "@/lib/fir";

export const dynamic = "force-dynamic";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Admin = ReturnType<typeof supabaseAdmin>;

/** Branch assets that sit in a real room/area (not "store"). */
async function roomedAssets(admin: Admin, code: string) {
  const { data } = await admin
    .from("assets")
    .select("id, room")
    .eq("current_branch", code);
  return ((data ?? []) as { id: string; room: string | null }[]).filter(
    (a) => a.room && a.room.trim().toLowerCase() !== "store"
  ) as { id: string; room: string }[];
}

/**
 * Inbound webhook from the FIR portal. FIR's Supabase posts a `portal.issues`
 * row here on insert/update. We act only on AC (HVAC) issues:
 *   • first time we see one  → flag the matching AC(s) + raise a notification;
 *   • when FIR marks it done → auto-log a Repair on those AC(s), clear the
 *     issue flag, and notify. Branch managers sometimes forget to log a
 *     repair by hand; this closes that gap. Such a repair has no manual
 *     service date, so it's flagged `from_fir` and shows its date as "—".
 * Secured by a shared secret; de-duplicated via the `fir_links` table.
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
  const done = firIsDone(rec);

  const admin = supabaseAdmin();

  // Register the FIR issue the first time we see it. A unique-violation means
  // we've seen it before (this is an update event, e.g. the resolution).
  const { error: linkErr } = await admin
    .from("fir_links")
    .insert({ fir_issue_id: rec.id, fir_no: firNo, branch: code, room_no: room || null });
  const isNew = !linkErr;
  if (linkErr && !(String(linkErr.code) === "23505" || /duplicate/i.test(linkErr.message))) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  // First sighting: match the AC(s), flag them, and raise the "issue" alert
  // (unless the issue arrives already-completed — then we skip straight to the
  // repair-done path below so we don't ping about an issue that's resolved).
  if (isNew) {
    const roomed = await roomedAssets(admin, code);
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

    if (!done) {
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
        `AC issue in ${code}${where} — ${title} (${firNo})${
          assetIds.length ? "" : " · no matching AC on record"
        }`,
        { kind: "fir_issue", asset_id: assetIds[0] ?? null }
      );
    }
  }

  // Resolution: FIR marked the issue done. Auto-log the repair on the linked
  // AC(s), exactly once (guarded by fir_links.resolved_at).
  if (done) {
    await resolveFir(admin, rec, code, firNo, title, room);
  }

  revalidateAll();
  return NextResponse.json({ ok: true, branch: code, firNo, new: isNew, done });
}

/** Auto-log a Repair for the AC(s) a resolved FIR issue was linked to. */
async function resolveFir(
  admin: Admin,
  rec: FirIssue,
  code: string,
  firNo: string,
  title: string,
  room: string
) {
  const { data: link } = await admin
    .from("fir_links")
    .select("asset_ids, resolved_at")
    .eq("fir_issue_id", rec.id)
    .maybeSingle();
  if (!link || link.resolved_at) return; // unknown or already handled

  const assetIds = ((link.asset_ids ?? []) as string[]).filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);
  const notes = rec.completion_notes
    ? String(rec.completion_notes).slice(0, 500)
    : "Resolved via FIR — auto-logged (no manual service date on record)";

  for (const id of assetIds) {
    await admin.from("jobs").insert({
      asset_id: id,
      date: today, // satisfies NOT NULL / ordering; UI hides it for FIR repairs
      type: "Repair",
      from_fir: true,
      problem: `AC issue (${firNo})${title ? `: ${title}` : ""}`,
      work_done: notes,
      bill_amount: 0,
      days_taken: 0,
      created_by: null,
      created_by_name: "FIR portal",
    });
    await admin
      .from("assets")
      .update({ open_issue: null, under_repair: false, repair_started_at: null, repair_note: null })
      .eq("id", id);
    await admin.from("asset_events").insert({
      asset_id: id,
      kind: "repair",
      description: `Repair done via FIR ${firNo} — auto-logged (no manual service date on record)`,
      actor_name: "FIR portal",
    });
  }

  await admin
    .from("fir_links")
    .update({ resolved_at: new Date().toISOString() })
    .eq("fir_issue_id", rec.id);

  const where = room ? ` Room ${room}` : rec.location ? ` (${rec.location})` : "";
  await notify(
    ["repair", ...branchInbox(code)],
    `AC repair done (via FIR) in ${code}${where} — ${title} (${firNo})${
      assetIds.length ? ` · +1 repair logged` : " · no AC was linked"
    }`,
    { kind: "fir_resolved", asset_id: assetIds[0] ?? null }
  );
}
