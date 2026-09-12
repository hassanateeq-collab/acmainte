"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/app/actions/assets";

export function SubmitButton({
  label,
  pendingLabel,
  danger,
}: {
  label: string;
  pendingLabel?: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
      disabled={pending}
    >
      {pending ? pendingLabel ?? "Saving…" : label}
    </button>
  );
}

export function FormError({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return (
    <div
      style={{
        background: "#fef2f2",
        color: "#b91c1c",
        border: "1px solid #fecaca",
        borderRadius: 10,
        padding: "9px 12px",
        fontSize: 13,
        marginBottom: 12,
      }}
    >
      {state.error}
    </div>
  );
}

/** Closes the modal and refreshes server data when the action succeeds. */
export function useOnSuccess(state: ActionState, close: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      close();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
    >
      {children}
    </div>
  );
}
