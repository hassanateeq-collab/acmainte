import type { AssetStatus } from "@/lib/types";
import { statusColor } from "@/lib/status";

export function StatusBadge({
  status,
  note,
}: {
  status: AssetStatus;
  note?: string | null;
}) {
  const c = statusColor(status);
  return (
    <span className={`chip ${c.bg} ${c.text}`}>
      <span
        className={c.dot}
        style={{ width: 7, height: 7, borderRadius: 999, display: "inline-block" }}
      />
      {status}
      {note ? ` · ${note}` : ""}
    </span>
  );
}

export function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "amber" | "brand";
}) {
  const map = {
    muted: { bg: "#eef1f4", color: "#5b6470" },
    amber: { bg: "#fef3c7", color: "#92400e" },
    brand: { bg: "#d7f0ec", color: "#0b5a54" },
  } as const;
  const s = map[tone];
  return (
    <span
      className="chip"
      style={{ background: s.bg, color: s.color, fontSize: 11.5 }}
    >
      {children}
    </span>
  );
}
