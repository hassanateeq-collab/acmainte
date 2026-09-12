"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { deleteAssetAction, type ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess } from "./forms/bits";

export default function DeleteAsset({
  assetId,
  triggerLabel = "Delete",
  triggerClassName = "btn btn-sm",
  redirectTo,
}: {
  assetId: string;
  triggerLabel?: React.ReactNode;
  triggerClassName?: string;
  /** Where to go after a successful delete (e.g. "/assets" from the record page). */
  redirectTo?: string;
}) {
  return (
    <Modal
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      title={`Delete ${assetId}?`}
      subtitle="This permanently removes the asset and its history (jobs, transfers, pairing, timeline). This cannot be undone."
    >
      {(close) => <Inner assetId={assetId} close={close} redirectTo={redirectTo} />}
    </Modal>
  );
}

function Inner({
  assetId,
  close,
  redirectTo,
}: {
  assetId: string;
  close: () => void;
  redirectTo?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(deleteAssetAction, {});
  const router = useRouter();

  // When a redirect target is given (record page), navigate away on success so
  // the browser doesn't land on the now-deleted asset's URL (a 404).
  useEffect(() => {
    if (state?.ok && redirectTo) {
      router.push(redirectTo);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Without a redirect target (list page), just close + refresh in place.
  useOnSuccess(redirectTo ? {} : state, close);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <p style={{ fontSize: 14, marginBottom: 14 }}>
        Are you sure you want to permanently delete <strong>{assetId}</strong>?
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>
          Cancel
        </button>
        <SubmitButton label="Delete asset" danger pendingLabel="Deleting…" />
      </div>
    </form>
  );
}
