"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { createTypeAction, deleteTypeAction } from "@/app/actions/types";
import type { ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess, Field, Row } from "./forms/bits";
import type { AssetType } from "@/lib/types";

export default function ManageTypes({ types }: { types: AssetType[] }) {
  return (
    <Modal
      triggerLabel="Asset types"
      triggerClassName="btn"
      title="Asset types"
      subtitle="The kinds of asset you track. AC uses interior/exterior parts; others usually don't."
    >
      {() => <Inner types={types} />}
    </Modal>
  );
}

function Inner({ types }: { types: AssetType[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createTypeAction, {});
  const router = useRouter();
  useOnSuccess(state, () => router.refresh());

  return (
    <div>
      {/* Existing types */}
      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <table className="data">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Parts</th><th></th></tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.code}>
                <td style={{ fontWeight: 700 }}>{t.code}</td>
                <td>{t.name}</td>
                <td>{t.has_parts ? "Interior / Exterior" : "Single unit"}</td>
                <td><DeleteType code={t.code} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add a type */}
      <form action={action}>
        <FormError state={state} />
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Add a type</div>
        <Row>
          <Field label="Code (e.g. GEN)">
            <input name="code" className="input" placeholder="GEN" autoCapitalize="characters" required />
          </Field>
          <Field label="Name">
            <input name="name" className="input" placeholder="Generator" required />
          </Field>
        </Row>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, margin: "4px 0 12px" }}>
          <input type="checkbox" name="has_parts" value="true" />
          Has interior &amp; exterior parts (like AC)
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <SubmitButton label="Add type" />
        </div>
      </form>
    </div>
  );
}

function DeleteType({ code }: { code: string }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteTypeAction, {});
  const router = useRouter();
  if (state?.ok) router.refresh();
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input type="hidden" name="code" value={code} />
      <button type="submit" className="btn btn-sm">Remove</button>
      {state?.error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{state.error}</span>}
    </form>
  );
}
