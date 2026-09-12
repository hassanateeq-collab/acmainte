"use client";

import { useActionState } from "react";
import Modal from "@/components/Modal";
import { deleteAssetAction, type ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess } from "./forms/bits";

export default function DeleteAsset({
  assetId,
  triggerLabel = "Delete",
  triggerClassName = "btn btn-sm",
}: {
  assetId: string;
  triggerLabel?: React.ReactNode;
  triggerClassName?: string;
}) {
  return (
    <Modal
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      title={`Delete ${assetId}?`}
      subtitle="This permanently removes the asset and its history (jobs, transfers, pairing, timeline). This cannot be undone."
    >
      {(close) => <Inner assetId={assetId} close={close} />}
    </Modal>
  );
}

function Inner({ assetId, close }: { assetId: string; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteAssetAction, {});
  useOnSuccess(state, close);
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
