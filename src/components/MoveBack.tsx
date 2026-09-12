"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { moveBackAction } from "@/app/actions/transfers";
import type { ActionState } from "@/app/actions/assets";

/** Return a moved asset to its home branch. */
export default function MoveBack({
  assetId,
  homeBranch,
}: {
  assetId: string;
  homeBranch: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(moveBackAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <input type="hidden" name="asset_id" value={assetId} />
      <button className="btn btn-sm" type="submit">
        ↩ Move back to {homeBranch}
      </button>
      {state?.error && (
        <span style={{ color: "#b91c1c", fontSize: 12 }}>{state.error}</span>
      )}
    </form>
  );
}
