"use client";

import { useActionState } from "react";
import Modal from "@/components/Modal";
import { addChargeAction } from "@/app/actions/jobs";
import type { ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess, Field, Row } from "./forms/bits";

export default function StandaloneCharge({ assets }: { assets: { id: string; branch: string }[] }) {
  return (
    <Modal
      triggerLabel="+ Standalone charge"
      triggerClassName="btn btn-primary"
      title="Add a standalone charge"
      subtitle="A visit or inspection fee with no service done. Shown as its own Charge line."
    >
      {(close) => <Inner assets={assets} close={close} />}
    </Modal>
  );
}

function Inner({ assets, close }: { assets: { id: string; branch: string }[]; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(addChargeAction, {});
  useOnSuccess(state, close);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action}>
      <FormError state={state} />
      <Field label="Asset">
        <select name="asset_id" className="select" required defaultValue="">
          <option value="" disabled>Choose an asset…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>{a.id} · {a.branch}</option>
          ))}
        </select>
      </Field>
      <Field label="Charge label"><input name="label" className="input" required placeholder="e.g. Inspection visit" /></Field>
      <Row>
        <Field label="Amount (Rs)"><input type="number" name="amount" className="input" min={1} required /></Field>
        <Field label="Date"><input type="date" name="date" className="input" defaultValue={today} /></Field>
      </Row>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Add charge" />
      </div>
    </form>
  );
}
