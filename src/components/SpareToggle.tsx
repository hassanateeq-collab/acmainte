"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setSpareAction, type ActionState } from "@/app/actions/assets";

/**
 * Owning branch manager / admin toggles whether this unit is a labelled spare.
 * A spare shows up on the Move page for other branches to request.
 */
export default function SpareToggle({
  assetId,
  isSpare,
}: {
  assetId: string;
  isSpare: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setSpareAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <input type="hidden" name="asset_id" value={assetId} />
      <input type="hidden" name="spare" value={isSpare ? "0" : "1"} />
      <button className={`btn btn-sm ${isSpare ? "" : "btn-primary"}`} type="submit">
        {isSpare ? "Remove spare label" : "Mark as spare"}
      </button>
      {state?.error && (
        <span style={{ color: "#b91c1c", fontSize: 12 }}>{state.error}</span>
      )}
    </form>
  );
}
