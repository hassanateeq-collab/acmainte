"use client";

import { useActionState, useState } from "react";
import Modal from "@/components/Modal";
import { createAssetAction, type ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess, Field, Row } from "./bits";
import type { Branch, Profile } from "@/lib/types";

export default function AddAssetForm({
  branches,
  profile,
}: {
  branches: Branch[];
  profile: Profile;
}) {
  const lockedBranch =
    profile.role === "branch_manager" ? profile.branch_code : null;

  return (
    <Modal
      triggerLabel="+ Add asset"
      triggerClassName="btn btn-primary"
      title="Add an asset"
      subtitle="Register a new unit. The ID sticker stays with it for life."
    >
      {(close) => (
        <Inner branches={branches} lockedBranch={lockedBranch} close={close} />
      )}
    </Modal>
  );
}

function Inner({
  branches,
  lockedBranch,
  close,
}: {
  branches: Branch[];
  lockedBranch: string | null;
  close: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createAssetAction,
    {}
  );
  useOnSuccess(state, close);

  const [type, setType] = useState("AC");
  const [part, setPart] = useState("I");
  const [branch, setBranch] = useState(lockedBranch || branches[0]?.code || "");

  const partSeg = type === "AC" ? `-${part}` : "";
  const idPreview = branch ? `${type}-${branch}${partSeg}-###` : "—";

  return (
    <form action={action}>
      <FormError state={state} />

      <Row>
        <Field label="Type">
          <select
            name="type"
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="AC">AC — Air conditioner</option>
          </select>
        </Field>
        {type === "AC" && (
          <Field label="Part">
            <select
              name="part"
              className="select"
              value={part}
              onChange={(e) => setPart(e.target.value)}
            >
              <option value="I">Interior (indoor unit)</option>
              <option value="E">Exterior (outdoor / compressor)</option>
            </select>
          </Field>
        )}
      </Row>

      <Row>
        <Field label="Home branch">
          <select
            name="home_branch"
            className="select"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            disabled={!!lockedBranch}
          >
            {branches.map((b) => (
              <option key={b.code} value={b.code}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Room (blank = store / spare)">
          <input name="room" className="input" placeholder="e.g. 204 or store" />
        </Field>
      </Row>

      <div
        style={{
          background: "#f6f7f9",
          border: "1px dashed var(--line)",
          borderRadius: 10,
          padding: "10px 12px",
          margin: "2px 0 14px",
          fontSize: 13.5,
        }}
      >
        ID it will get: <strong style={{ letterSpacing: 0.3 }}>{idPreview}</strong>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
          The three-digit number is assigned in sequence when you save.
        </div>
      </div>

      <Row>
        <Field label="Installed date">
          <input type="date" name="installed_date" className="input" />
        </Field>
        <Field label="Last service date (optional)">
          <input type="date" name="last_service_date" className="input" />
        </Field>
      </Row>

      <Row>
        <Field label="Expected life (years)">
          <input
            type="number"
            name="expected_life_years"
            className="input"
            defaultValue={10}
            min={1}
          />
        </Field>
        <Field label="Service interval (days)">
          <input
            type="number"
            name="service_interval_days"
            className="input"
            defaultValue={90}
            min={1}
          />
        </Field>
      </Row>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button type="button" className="btn" onClick={close}>
          Cancel
        </button>
        <SubmitButton label="Save asset" />
      </div>
    </form>
  );
}
