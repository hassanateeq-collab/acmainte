"use client";

import { useActionState, useState } from "react";
import Modal from "@/components/Modal";
import { createAssetAction, type ActionState } from "@/app/actions/assets";
import { SubmitButton, FormError, useOnSuccess, Field, Row } from "./bits";
import type { AssetType, Branch, Profile } from "@/lib/types";

export default function AddAssetForm({
  branches,
  profile,
  types,
  defaultBranch,
  defaultRoom,
  triggerLabel = "+ Add asset",
  triggerClassName = "btn btn-primary",
}: {
  branches: Branch[];
  profile: Profile;
  types: AssetType[];
  defaultBranch?: string | null;
  defaultRoom?: string | null;
  triggerLabel?: React.ReactNode;
  triggerClassName?: string;
}) {
  // Lock the branch when adding from a room, or for a branch manager.
  const lockedBranch =
    defaultBranch ??
    (profile.role === "branch_manager" ? profile.branch_code : null);

  return (
    <Modal
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      title="Add an asset"
      subtitle="Register a new unit. The ID sticker stays with it for life."
    >
      {(close) => (
        <Inner
          branches={branches}
          lockedBranch={lockedBranch}
          types={types}
          defaultRoom={defaultRoom ?? null}
          close={close}
        />
      )}
    </Modal>
  );
}

function Inner({
  branches,
  lockedBranch,
  types,
  defaultRoom,
  close,
}: {
  branches: Branch[];
  lockedBranch: string | null;
  types: AssetType[];
  defaultRoom: string | null;
  close: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createAssetAction,
    {}
  );
  useOnSuccess(state, close);

  const [typeCode, setTypeCode] = useState(types[0]?.code || "AC");
  const [part, setPart] = useState("I");
  const [branch, setBranch] = useState(lockedBranch || branches[0]?.code || "");
  const [num, setNum] = useState("");

  const selectedType = types.find((t) => t.code === typeCode) ?? types[0];
  const hasParts = !!selectedType?.has_parts;
  const partSeg = hasParts ? `-${part}` : "";
  const raw = num.trim().toUpperCase();
  const numSeg = raw ? (/^\d+$/.test(raw) ? raw.padStart(3, "0") : raw) : "###";
  const idPreview = branch ? `${typeCode}-${branch}${partSeg}-${numSeg}` : "—";

  return (
    <form action={action}>
      <FormError state={state} />

      <Row>
        <Field label="Type">
          <select
            name="type"
            className="select"
            value={typeCode}
            onChange={(e) => setTypeCode(e.target.value)}
          >
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
        </Field>
        {hasParts && (
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
          {/* When locked, the <select> is disabled and browsers don't submit
              disabled fields — so carry the value in a hidden input. */}
          <select
            name={lockedBranch ? undefined : "home_branch"}
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
          {lockedBranch && <input type="hidden" name="home_branch" value={branch} />}
        </Field>
        <Field label="Room (blank = store / spare)">
          <input
            name="room"
            className="input"
            placeholder="e.g. 204 or store"
            defaultValue={defaultRoom ?? undefined}
          />
        </Field>
      </Row>

      <Field label="Number (leave blank to auto-assign)">
        <input
          name="id_number"
          className="input"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder="e.g. 204"
          inputMode="numeric"
        />
      </Field>

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
          Type ({typeCode}), branch ({branch || "—"}) and part are set from your
          choices above — you only enter the number. Leave it blank to auto-assign
          the next one.
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
        <Field label="General service (days)">
          <input
            type="number"
            name="general_interval_days"
            className="input"
            defaultValue={90}
            min={1}
          />
        </Field>
        <Field label="Master service (days)">
          <input
            type="number"
            name="service_interval_days"
            className="input"
            defaultValue={365}
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
