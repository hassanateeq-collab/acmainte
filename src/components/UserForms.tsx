"use client";

import { useActionState, useState } from "react";
import Modal from "@/components/Modal";
import { createUserAction, updateUserAction, deleteUserAction } from "@/app/actions/users";
import type { ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess, Field, Row } from "./forms/bits";
import type { Branch, Profile } from "@/lib/types";

export function AddPerson({ branches }: { branches: Branch[] }) {
  return (
    <Modal triggerLabel="+ Add person" triggerClassName="btn btn-primary" title="Add a person" subtitle="Creates a login. They sign in with the email and password you set.">
      {(close) => <AddInner branches={branches} close={close} />}
    </Modal>
  );
}

function AddInner({ branches, close }: { branches: Branch[]; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(createUserAction, {});
  useOnSuccess(state, close);
  const [role, setRole] = useState("branch_manager");
  return (
    <form action={action}>
      <FormError state={state} />
      <Row>
        <Field label="Full name"><input name="full_name" className="input" placeholder="Jane Doe" /></Field>
        <Field label="Email"><input type="email" name="email" className="input" required /></Field>
      </Row>
      <Field label="Password (min 8 chars)"><input type="text" name="password" className="input" required minLength={8} /></Field>
      <Row>
        <Field label="Role">
          <select name="role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">Admin (head office)</option>
            <option value="branch_manager">Branch manager</option>
            <option value="repair">CoolTech (repair)</option>
          </select>
        </Field>
        <Field label="Branch">
          <select name="branch_code" className="select" disabled={role !== "branch_manager"} defaultValue="">
            <option value="">—</option>
            {branches.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
          </select>
        </Field>
      </Row>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Create person" />
      </div>
    </form>
  );
}

export function PersonActions({ person, branches }: { person: Profile; branches: Branch[] }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <Modal triggerLabel="Edit" triggerClassName="btn btn-sm" title={`Edit ${person.full_name || person.email}`}>
        {(close) => <EditInner person={person} branches={branches} close={close} />}
      </Modal>
      <Modal triggerLabel="Remove" triggerClassName="btn btn-sm" title="Remove person" subtitle="Their login is deleted. This cannot be undone.">
        {(close) => <RemoveInner id={person.id} close={close} />}
      </Modal>
    </div>
  );
}

function EditInner({ person, branches, close }: { person: Profile; branches: Branch[]; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(updateUserAction, {});
  useOnSuccess(state, close);
  const [role, setRole] = useState(person.role);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="id" value={person.id} />
      <Row>
        <Field label="Role">
          <select name="role" className="select" value={role} onChange={(e) => setRole(e.target.value as Profile["role"])}>
            <option value="admin">Admin (head office)</option>
            <option value="branch_manager">Branch manager</option>
            <option value="repair">CoolTech (repair)</option>
          </select>
        </Field>
        <Field label="Branch">
          <select name="branch_code" className="select" disabled={role !== "branch_manager"} defaultValue={person.branch_code ?? ""}>
            <option value="">—</option>
            {branches.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
          </select>
        </Field>
      </Row>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Save" />
      </div>
    </form>
  );
}

function RemoveInner({ id, close }: { id: string; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteUserAction, {});
  useOnSuccess(state, close);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="id" value={id} />
      <p style={{ fontSize: 14, marginBottom: 14 }}>Are you sure you want to remove this person's login?</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Remove" danger pendingLabel="Removing…" />
      </div>
    </form>
  );
}
