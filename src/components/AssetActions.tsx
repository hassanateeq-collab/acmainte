"use client";

import { useActionState } from "react";
import Modal from "@/components/Modal";
import {
  reportIssueAction,
  changePairingAction,
  pickupAction,
  type ActionState,
} from "@/app/actions/assets";
import { requestTransferAction } from "@/app/actions/transfers";
import { logJobAction, addChargeAction } from "@/app/actions/jobs";
import DeleteAsset from "./DeleteAsset";
import EditAsset from "./EditAsset";
import QuickComplete from "./QuickComplete";
import SpareToggle from "./SpareToggle";
import MoveBack from "./MoveBack";
import { SubmitButton, FormError, useOnSuccess, Field, Row } from "./forms/bits";
import { useRouter } from "next/navigation";
import { daysToService, nextServiceDate, generalDays, masterDays } from "@/lib/status";
import { fmtDate } from "@/lib/format";
import type { Asset, Branch, Profile } from "@/lib/types";

export default function AssetActions({
  asset,
  profile,
  branches,
  candidates,
}: {
  asset: Asset;
  profile: Profile;
  branches: Branch[];
  candidates: Asset[]; // opposite-part assets available to pair
}) {
  const isAdmin = profile.role === "admin";
  const ownsBranch =
    isAdmin ||
    (profile.role === "branch_manager" && profile.branch_code === asset.current_branch);

  // A part living away from its home branch is "borrowed": the holding branch
  // may only send it back, not re-label it spare or transfer it onward.
  const atHome = asset.current_branch === asset.home_branch;

  // Quick "mark done" only makes sense when there's something to complete.
  const dts = daysToService(asset);
  const nsd = nextServiceDate(asset);
  const gd = generalDays(asset);
  const md = masterDays(asset);
  const generalDue = gd !== null && gd <= 14;
  const masterDue = md !== null && md <= 14;
  const hasIssue = !!asset.open_issue;
  const atVendor = asset.at_vendor;
  const canComplete = ownsBranch;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {ownsBranch && (
        <Modal
          triggerLabel="Report an issue"
          title={`Report an issue — ${asset.id}`}
          subtitle="Admin is notified. The unit shows 'Issue reported' until a repair is logged."
        >
          {(close) => <ReportIssue assetId={asset.id} close={close} />}
        </Modal>
      )}

      <Modal
        triggerLabel="Log service / repair"
        triggerClassName="btn btn-primary"
        title={`Log service / repair — ${asset.id}`}
        subtitle="Sets the last-service date, clears any open issue, and marks the unit returned from CoolTech."
      >
        {(close) => <LogJob assetId={asset.id} close={close} />}
      </Modal>

      {canComplete && (generalDue || atVendor) && (
        <QuickComplete assetId={asset.id} kind="Service" serviceKind="General" label="✓ General service done" />
      )}
      {canComplete && (masterDue || atVendor) && (
        <QuickComplete assetId={asset.id} kind="Service" serviceKind="Master" label="✓ Master service done" />
      )}
      {canComplete && (hasIssue || atVendor) && (
        <QuickComplete assetId={asset.id} kind="Repair" />
      )}

      {/* When neither service is due, show when the next one is. */}
      {!generalDue && !masterDue && !atVendor && nsd && (
        <span
          className="chip"
          style={{ background: "#eef6ff", color: "#1e3a8a" }}
        >
          Next service: {fmtDate(nsd.toISOString())}
          {dts !== null ? ` · in ${dts} day${dts === 1 ? "" : "s"}` : ""}
        </span>
      )}

      {isAdmin && (
        <Modal
          triggerLabel="Add charge"
          title={`Add a standalone charge — ${asset.id}`}
          subtitle="A visit or inspection fee with no service done. Does not change the service date."
        >
          {(close) => <AddCharge assetId={asset.id} close={close} />}
        </Modal>
      )}

      {ownsBranch && (
        <Modal
          triggerLabel="Change pairing"
          title={`Change pairing — ${asset.id}`}
          subtitle="Pick the opposite part to connect, or keep this unit as a spare. A reason is required."
        >
          {(close) => (
            <ChangePairing asset={asset} candidates={candidates} close={close} />
          )}
        </Modal>
      )}

      {ownsBranch && atHome && (
        <Modal
          triggerLabel="Request transfer"
          title={`Request transfer — ${asset.id}`}
          subtitle="Ask the branch that holds this part to send it to another branch."
        >
          {(close) => (
            <RequestTransfer asset={asset} branches={branches} profile={profile} close={close} />
          )}
        </Modal>
      )}

      {ownsBranch && !asset.at_vendor && (
        <PickupButton assetId={asset.id} />
      )}

      {ownsBranch && atHome && (
        <SpareToggle assetId={asset.id} isSpare={!!asset.is_spare} />
      )}

      {ownsBranch && asset.current_branch !== asset.home_branch && (
        <MoveBack assetId={asset.id} homeBranch={asset.home_branch} />
      )}

      {ownsBranch && (
        <EditAsset
          asset={{
            id: asset.id,
            room: asset.room,
            installed_date: asset.installed_date,
            last_service_date: asset.last_service_date,
            last_general_service_date: asset.last_general_service_date,
            expected_life_years: asset.expected_life_years,
            service_interval_days: asset.service_interval_days,
            general_interval_days: asset.general_interval_days,
          }}
          triggerLabel="Edit details"
        />
      )}

      {/* A borrowed part (away from home) can only be deleted by Admin. */}
      {ownsBranch && (isAdmin || atHome) && (
        <DeleteAsset
          assetId={asset.id}
          triggerLabel="Delete asset"
          triggerClassName="btn btn-sm btn-danger"
          redirectTo="/assets"
        />
      )}
    </div>
  );
}

/* ------------------------------- sub-forms ------------------------------- */

function ReportIssue({ assetId, close }: { assetId: string; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(reportIssueAction, {});
  useOnSuccess(state, close);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <Field label="What is wrong?">
        <textarea
          name="description"
          className="textarea"
          rows={4}
          placeholder="e.g. Not cooling, tripping the breaker…"
          required
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Report issue" />
      </div>
    </form>
  );
}

function LogJob({ assetId, close }: { assetId: string; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(logJobAction, {});
  useOnSuccess(state, close);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <Row>
        <Field label="Type">
          <select name="type" className="select" defaultValue="Service">
            <option>Service</option>
            <option>Repair</option>
          </select>
        </Field>
        <Field label="Service type (for a service)">
          <select name="service_kind" className="select" defaultValue="General">
            <option value="General">General (3-monthly)</option>
            <option value="Master">Master (yearly)</option>
          </select>
        </Field>
      </Row>
      <Field label="Date">
        <input type="date" name="date" className="input" defaultValue={today} />
      </Field>
      <Field label="Problem">
        <textarea name="problem" className="textarea" rows={2} placeholder="What was reported / found" />
      </Field>
      <Field label="What was done / part replaced">
        <textarea name="work_done" className="textarea" rows={2} />
      </Field>
      <Row>
        <Field label="Bill amount (Rs)">
          <input type="number" name="bill_amount" className="input" min={0} step="1" defaultValue={0} />
        </Field>
        <Field label="Days taken">
          <input type="number" name="days_taken" className="input" min={0} defaultValue={0} />
        </Field>
      </Row>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Save job" />
      </div>
    </form>
  );
}

function AddCharge({ assetId, close }: { assetId: string; close: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(addChargeAction, {});
  useOnSuccess(state, close);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <Field label="Charge label">
        <input name="label" className="input" placeholder="e.g. Inspection visit, gas top-up" required />
      </Field>
      <Row>
        <Field label="Amount (Rs)">
          <input type="number" name="amount" className="input" min={1} step="1" required />
        </Field>
        <Field label="Date">
          <input type="date" name="date" className="input" defaultValue={today} />
        </Field>
      </Row>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Add charge" />
      </div>
    </form>
  );
}

function ChangePairing({
  asset,
  candidates,
  close,
}: {
  asset: Asset;
  candidates: Asset[];
  close: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(changePairingAction, {});
  useOnSuccess(state, close);
  const oppositeLabel = asset.part === "I" ? "exterior" : "interior";
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={asset.id} />
      <Field label={`Connect to which ${oppositeLabel}?`}>
        <select name="target_id" className="select" defaultValue={asset.paired_with ?? ""}>
          <option value="">Nothing — keep as spare</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} · {c.current_branch}
              {c.paired_with ? ` (now paired to ${c.paired_with})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Reason (required)">
        <textarea name="reason" className="textarea" rows={3} required placeholder="Why is the pairing changing?" />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Save pairing" />
      </div>
    </form>
  );
}

function RequestTransfer({
  asset,
  branches,
  profile,
  close,
}: {
  asset: Asset;
  branches: Branch[];
  profile: Profile;
  close: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(requestTransferAction, {});
  useOnSuccess(state, close);
  const lockedTo = profile.role === "branch_manager" ? profile.branch_code : null;
  const options = branches.filter((b) => b.code !== asset.current_branch);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="asset_id" value={asset.id} />
      <div style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 10 }}>
        Currently at <strong>{asset.current_branch}</strong>.
      </div>
      <Field label="Send to branch">
        <select
          name="to_branch"
          className="select"
          defaultValue={lockedTo ?? ""}
          disabled={!!lockedTo}
        >
          {!lockedTo && <option value="">Choose a branch…</option>}
          {options.map((b) => (
            <option key={b.code} value={b.code}>
              {b.code} — {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Install in which room?">
        <input name="to_room" className="input" placeholder="e.g. 210" required />
      </Field>
      <Field label="Reason (required)">
        <textarea name="reason" className="textarea" rows={3} required />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <SubmitButton label="Send request" />
      </div>
    </form>
  );
}

function PickupButton({ assetId }: { assetId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(pickupAction, {});
  const router = useRouter();
  if (state?.ok) router.refresh();
  return (
    <form action={action}>
      <input type="hidden" name="asset_id" value={assetId} />
      <SubmitButtonPlain label="Pick up" />
    </form>
  );
}

function SubmitButtonPlain({ label }: { label: string }) {
  return (
    <button type="submit" className="btn">
      {label}
    </button>
  );
}
