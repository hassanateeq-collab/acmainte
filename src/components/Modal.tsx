"use client";

import { useEffect, useState } from "react";

export default function Modal({
  triggerLabel,
  triggerClassName = "btn",
  title,
  subtitle,
  children,
  wide,
}: {
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  title: string;
  subtitle?: string;
  children: (close: () => void) => React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,32,.42)",
            zIndex: 60,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "6vh 16px 24px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: "100%",
              maxWidth: wide ? 640 : 480,
              padding: 22,
              boxShadow: "0 24px 60px rgba(0,0,0,.22)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</h2>
                {subtitle && (
                  <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "4px 0 0" }}>
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "var(--muted)",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ marginTop: 16 }}>{children(() => setOpen(false))}</div>
          </div>
        </div>
      )}
    </>
  );
}
