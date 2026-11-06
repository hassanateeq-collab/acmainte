import "server-only";

/**
 * Linkage to the FIR portal (a separate Supabase project, `portal` schema).
 * When an AC issue is filed there, FIR posts the new/updated `portal.issues`
 * row to this portal's /api/fir-issue endpoint; we flag the matching AC and
 * raise a notification. These UUIDs are stable records in the FIR database.
 */

// FIR portal.branches.id -> this portal's branch code
export const FIR_BRANCH: Record<string, string> = {
  "80ef938d-2bbc-4f01-8f20-36f79cf32c2e": "FSL", // Shahrah-e-Faisal
  "e90f4be2-427b-4a56-ab0d-9cb85870fd5e": "EXT", // Extension
  "820030ed-c142-4aa9-80de-3d6f1a16e83c": "CLF", // Clifton
  "a3a77a82-9bac-40c3-8db9-131753bd2a62": "DHA", // DHA phase II
};

// portal.departments.id for "HVAC Technician" — i.e. an AC-related issue.
export const FIR_AC_DEPARTMENT = "dcdbd9fb-8032-47e9-b226-df0900355615";

/**
 * The HVAC Technician department also covers heating/ventilation, so we only
 * treat an issue as an AC issue when its title/description actually mentions an
 * AC ("AC", "A/C", "air con(ditioner)", "aircon"). The room/area still comes
 * from the FIR room_no/location — this gate is purely about the description.
 */
export function firMentionsAC(rec: { title?: string | null; description?: string | null }): boolean {
  const text = `${rec.title ?? ""} ${rec.description ?? ""}`.toLowerCase();
  return (
    /\bac\b/.test(text) ||
    /\ba\/?c\b/.test(text) ||
    /\bacs\b/.test(text) ||
    /air[\s-]?con/.test(text) ||
    /air[\s-]?cool/.test(text) ||
    /\bsplit\s*unit/.test(text)
  );
}

/** The slice of a portal.issues row we care about (from the webhook payload). */
export type FirIssue = {
  id: string;
  fir_no?: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  room_no?: string | null;
  location?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  completion_notes?: string | null;
  completed_at?: string | null;
  closed_at?: string | null;
  vendor_completed_at?: string | null;
  reject_reason?: string | null;
  return_reason?: string | null;
  deleted?: boolean | null;
};

/** FIR statuses that mean the issue is finished (the AC repair is done). */
export function firIsDone(rec: {
  status?: string | null;
  completed_at?: string | null;
  closed_at?: string | null;
}): boolean {
  const s = String(rec.status ?? "").trim().toLowerCase();
  if (/(^|_)(completed|complete|closed|resolved|done|verified|fixed)($|_)/.test(s))
    return true;
  return Boolean(rec.completed_at || rec.closed_at);
}

/** FIR issue was rejected / sent back — it should not count as an AC issue. */
export function firIsRejected(rec: {
  status?: string | null;
  reject_reason?: string | null;
}): boolean {
  const s = String(rec.status ?? "").trim().toLowerCase();
  if (/reject|declin|invalid|cancel/.test(s)) return true;
  return Boolean(rec.reject_reason);
}
