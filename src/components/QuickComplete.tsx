"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logJobAction } from "@/app/actions/jobs";
import type { ActionState } from "@/app/actions/assets";

/**
 * One-tap "mark done" for the repair person. Logs a minimal Service/Repair job
 * (today, no bill) via the normal action, which sets the last-service date,
 * clears any open issue, and marks the unit returned from CoolTech.
 */
export default function QuickComplete({
  assetId,
  kind,
  label,
}: {
  assetId: string;
  kind: "Service" | "Repair";
  label?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(logJobAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <input type="hidden" name="asset_id" value={assetId} />
      <input type="hidden" name="type" value={kind} />
      <input type="hidden" name="date" value={today} />
      <input type="hidden" name="bill_amount" value="0" />
      <input type="hidden" name="days_taken" value="0" />
      <button className="btn btn-sm btn-primary" type="submit">
        {label ?? `✓ ${kind} done`}
      </button>
      {state?.error && (
        <span
          style={{
            color: "#b91c1c",
            fontSize: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            padding: "4px 8px",
            maxWidth: 320,
          }}
        >
          {state.error}
        </span>
      )}
    </form>
  );
}
