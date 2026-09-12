"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { markInstalledAction } from "@/app/actions/transfers";
import type { ActionState } from "@/app/actions/assets";

/** CoolTech confirms a moved unit is installed into its destination room. */
export default function MarkInstalled({
  transferId,
  room,
}: {
  transferId: string;
  room: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(markInstalledAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <input type="hidden" name="transfer_id" value={transferId} />
      <button className="btn btn-sm btn-primary" type="submit">
        ✓ Installed{room ? ` in Room ${room}` : ""}
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
