"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { decideTransferAction } from "@/app/actions/transfers";
import type { ActionState } from "@/app/actions/assets";

export default function DecideTransfer({ transferId }: { transferId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    decideTransferAction,
    {}
  );
  const router = useRouter();
  if (state?.ok) router.refresh();

  return (
    <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <form action={action}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <input type="hidden" name="decision" value="accept" />
          <button className="btn btn-sm btn-primary" type="submit">Accept</button>
        </form>
        <form action={action}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <input type="hidden" name="decision" value="decline" />
          <button className="btn btn-sm" type="submit">Decline</button>
        </form>
      </div>
      {state?.error && (
        <span style={{ color: "#b91c1c", fontSize: 12 }}>{state.error}</span>
      )}
    </div>
  );
}
