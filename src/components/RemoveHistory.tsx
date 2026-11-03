"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { removeFirHistoryAction } from "@/app/actions/history";
import type { ActionState } from "@/app/actions/assets";

export default function RemoveHistory({ firIssueId }: { firIssueId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(removeFirHistoryAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Remove this FIR issue from history? (It was rejected / not a real AC issue.)"))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="fir_issue_id" value={firIssueId} />
      <button type="submit" className="btn btn-sm btn-danger" title="Remove (rejected)">
        Remove
      </button>
      {state?.error && (
        <span style={{ color: "#b91c1c", fontSize: 11 }}>{state.error}</span>
      )}
    </form>
  );
}
