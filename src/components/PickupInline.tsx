"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { pickupAction } from "@/app/actions/assets";
import type { ActionState } from "@/app/actions/assets";

export default function PickupInline({ assetId }: { assetId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(pickupAction, {});
  const router = useRouter();
  if (state?.ok) router.refresh();
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="asset_id" value={assetId} />
      <button className="btn btn-sm" type="submit">Pick up</button>
    </form>
  );
}
