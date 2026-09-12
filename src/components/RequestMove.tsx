"use client";

import { useActionState } from "react";
import Modal from "@/components/Modal";
import { requestTransferAction } from "@/app/actions/transfers";
import type { ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess } from "./forms/bits";

/**
 * Branch-manager action: request a spare part from another branch be moved
 * to my branch. The owning branch (or Admin) must approve.
 */
export default function RequestMove({
  assetId,
  toBranch,
  fromBranch,
}: {
  assetId: string;
  toBranch: string;
  fromBranch: string;
}) {
  return (
    <Modal
      triggerLabel="Request to move here"
      triggerClassName="btn btn-sm btn-primary"
      title={`Move ${assetId} → ${toBranch}`}
      subtitle={`This asks ${fromBranch} to release the part. It only moves once they accept.`}
    >
      {(close) => (
        <Inner assetId={assetId} toBranch={toBranch} close={close} />
      )}
    </Modal>
  );
}

function Inner({
  assetId,
  toBranch,
  close,
}: {
  assetId: string;
  toBranch: string;
  close: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    requestTransferAction,
    {}
  );
  useOnSuccess(state, close);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <input type="hidden" name="to_branch" value={toBranch} />
      <label className="label">Install in which room?</label>
      <input
        name="to_room"
        className="input"
        placeholder="e.g. 210"
        required
        style={{ marginBottom: 12 }}
      />
      <label className="label">Why do you need it?</label>
      <textarea
        name="reason"
        className="textarea"
        rows={3}
        placeholder="e.g. Room 210 interior unit failed, need a spare."
        required
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button type="button" className="btn" onClick={close}>
          Cancel
        </button>
        <SubmitButton label="Send request" pendingLabel="Sending…" />
      </div>
    </form>
  );
}
