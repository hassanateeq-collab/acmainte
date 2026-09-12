import "server-only";
import { supabaseAdmin } from "./supabase/admin";

type NotifyExtras = {
  kind?: string;
  asset_id?: string | null;
  transfer_id?: string | null;
};

/**
 * Insert one notification row per audience inbox. Admin always gets a copy
 * (the spec: "Admin sees everything"), so 'admin' is added automatically.
 */
export async function notify(
  audiences: string[],
  message: string,
  extras: NotifyExtras = {}
) {
  const set = new Set(audiences);
  set.add("admin");
  const rows = [...set].map((audience) => ({
    audience,
    message,
    kind: extras.kind ?? null,
    asset_id: extras.asset_id ?? null,
    transfer_id: extras.transfer_id ?? null,
  }));
  if (rows.length === 0) return;
  await supabaseAdmin().from("notifications").insert(rows);
}

export function branchInbox(code: string | null | undefined): string[] {
  return code ? [`branch:${code}`] : [];
}
