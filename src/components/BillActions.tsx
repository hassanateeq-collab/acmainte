"use client";

import { useActionState } from "react";
import Modal from "@/components/Modal";
import { editJobAction, deleteJobAction, addChargeAction } from "@/app/actions/jobs";
import type { ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess, Field, Row } from "./forms/bits";

type JobLite = {
  id: string;
  date: string;
  type: string;
  problem: string | null;
  work_done: string | null;
  bill_amount: number;
  days_taken: number;
};

export default function BillActions({
  job,
  canAdd,
  canEdit,
}: {
  job: JobLite;
  canAdd: boolean;
  canEdit: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {canAdd && (
        <Modal triggerLabel="Add charge" triggerClassName="btn btn-sm" title="Add a charge to this job" subtitle="Transport, gas top-up, etc. — added to this job's Additional column.">
          {(close) => <AddChargeToJob jobId={job.id} close={close} />}
        </Modal>
      )}
      {canEdit && (
        <>
          <Modal triggerLabel="Edit" triggerClassName="btn btn-sm" title="Edit bill entry" subtitle="A reason is required and kept in the change log.">
            {(close) => <EditJob job={job} close={close} />}
          </Modal>
          <Modal triggerLabel="Delete" triggerClassName="btn btn-sm" title="Delete bill entry" subtitle="This is logged to Admin. A reason is required.">
            {(close) => <DeleteJob jobId={job.id} close={close} />}
          </Modal>
        </>
      )}
    </div>
  );
}

function AddChargeToJob({ jobId, close }: { jobId: string; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(addChargeAction, {});
  useOnSuccess(state, close);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="job_id" value={jobId} />
      <Field label="Charge label"><input name="label" className="input" required placeholder="e.g. Transport" /></Field>
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

function EditJob({ job, close }: { job: JobLite; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(editJobAction, {});
  useOnSuccess(state, close);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="job_id" value={job.id} />
      <Row>
        <Field label="Date"><input type="date" name="date" className="input" defaultValue={job.date} /></Field>
        <Field label="Days taken"><input type="number" name="days_taken" className="input" min={0} defaultValue={job.days_taken} /></Field>
      </Row>
      <Field label="Problem"><textarea name="problem" className="textarea" rows={2} defaultValue={job.problem ?? ""} /></Field>
      <Field label="What was done"><textarea name="work_done" className="textarea" rows={2} defaultValue={job.work_done ?? ""} /></Field>
      <Field label="Bill amount (Rs)"><input type="number" name="bill_amount" className="input" min={0} defaultValue={job.bill_amount} /></Field>
      <Field label="Reason for the change (required)"><textarea name="reason" className="textarea" rows={2} required /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Save changes" />
      </div>
    </form>
  );
}

function DeleteJob({ jobId, close }: { jobId: string; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteJobAction, {});
  useOnSuccess(state, close);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="job_id" value={jobId} />
      <Field label="Reason for deletion (required)"><textarea name="reason" className="textarea" rows={3} required /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Delete entry" danger pendingLabel="Deleting…" />
      </div>
    </form>
  );
}
