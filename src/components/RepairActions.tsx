"use client";

import { useActionState } from "react";
import Modal from "./Modal";
import { startRepairAction, completeRepairAction } from "@/app/actions/jobs";
import type { ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess, Field, Row } from "./forms/bits";

/**
 * Two-phase repair. First "Log repair" marks the AC under repair; later
 * "Repair done" captures the bill, the issue, and the item replaced, and
 * logs the Repair job.
 */
export default function RepairActions({
  assetId,
  underRepair,
  startedAt,
  note,
}: {
  assetId: string;
  underRepair: boolean;
  startedAt?: string | null;
  note?: string | null;
}) {
  if (!underRepair) {
    return (
      <Modal
        triggerLabel="Log repair"
        triggerClassName="btn btn-sm"
        title={`Log a repair — ${assetId}`}
        subtitle="Marks the AC 'Under repair'. You'll enter the bill and details when it's done."
      >
        {(close) => <StartForm assetId={assetId} close={close} />}
      </Modal>
    );
  }
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <Modal
        triggerLabel="✓ Repair done"
        triggerClassName="btn btn-sm btn-primary"
        title={`Complete repair — ${assetId}`}
        subtitle="Enter the bill, what the issue was, and the item replaced."
      >
        {(close) => <DoneForm assetId={assetId} note={note} close={close} />}
      </Modal>
      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
        Under repair{startedAt ? ` since ${new Date(startedAt).toLocaleDateString()}` : ""}
        {note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}

function StartForm({ assetId, close }: { assetId: string; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(startRepairAction, {});
  useOnSuccess(state, close);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <Field label="Repair started on">
        <input type="date" name="date" className="input" defaultValue={today} />
      </Field>
      <Field label="What looks wrong? (optional)">
        <textarea
          name="note"
          className="textarea"
          rows={3}
          placeholder="e.g. Not cooling, compressor noise…"
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Start repair" />
      </div>
    </form>
  );
}

function DoneForm({
  assetId,
  note,
  close,
}: {
  assetId: string;
  note?: string | null;
  close: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(completeRepairAction, {});
  useOnSuccess(state, close);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <Field label="What was the issue?">
        <textarea
          name="problem"
          className="textarea"
          rows={2}
          defaultValue={note ?? ""}
          placeholder="What was wrong / found"
        />
      </Field>
      <Field label="What item was replaced / work done">
        <textarea
          name="work_done"
          className="textarea"
          rows={2}
          placeholder="e.g. Replaced capacitor, gas refill…"
        />
      </Field>
      <Row>
        <Field label="Bill amount (Rs)">
          <input type="number" name="bill_amount" className="input" min={0} step="1" defaultValue={0} />
        </Field>
        <Field label="Days taken">
          <input type="number" name="days_taken" className="input" min={0} defaultValue={0} />
        </Field>
      </Row>
      <Field label="Date completed">
        <input type="date" name="date" className="input" defaultValue={today} />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Save repair" />
      </div>
    </form>
  );
}
