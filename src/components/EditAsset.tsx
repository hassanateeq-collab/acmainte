"use client";

import { useActionState } from "react";
import Modal from "@/components/Modal";
import { updateAssetAction, type ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess, Field, Row } from "./forms/bits";

export type EditableAsset = {
  id: string;
  room: string | null;
  installed_date: string | null;
  last_service_date: string | null;
  expected_life_years: number;
  service_interval_days: number;
};

export default function EditAsset({
  asset,
  triggerLabel = "Edit",
  triggerClassName = "btn btn-sm",
}: {
  asset: EditableAsset;
  triggerLabel?: React.ReactNode;
  triggerClassName?: string;
}) {
  return (
    <Modal
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      title={`Edit ${asset.id}`}
      subtitle="Update where it is and its service settings. The ID never changes."
    >
      {(close) => <Inner asset={asset} close={close} />}
    </Modal>
  );
}

function Inner({ asset, close }: { asset: EditableAsset; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(updateAssetAction, {});
  useOnSuccess(state, close);
  const room = asset.room && asset.room.toLowerCase() !== "store" ? asset.room : "";
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={asset.id} />
      <Field label="Room (blank = store / spare)">
        <input name="room" className="input" defaultValue={room} placeholder="e.g. 204 or store" />
      </Field>
      <Row>
        <Field label="Installed date">
          <input type="date" name="installed_date" className="input" defaultValue={asset.installed_date ?? ""} />
        </Field>
        <Field label="Last service date">
          <input type="date" name="last_service_date" className="input" defaultValue={asset.last_service_date ?? ""} />
        </Field>
      </Row>
      <Row>
        <Field label="Expected life (years)">
          <input type="number" name="expected_life_years" className="input" min={1} defaultValue={asset.expected_life_years} />
        </Field>
        <Field label="Service interval (days)">
          <input type="number" name="service_interval_days" className="input" min={1} defaultValue={asset.service_interval_days} />
        </Field>
      </Row>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Save changes" />
      </div>
    </form>
  );
}
