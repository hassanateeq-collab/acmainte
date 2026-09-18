import type { Asset, AssetStatus } from "./types";

export type ServiceKind = "General" | "Normal";

const DEFAULT_GENERAL_DAYS = 30; // monthly
const DEFAULT_NORMAL_DAYS = 90; // quarterly

function addDaysTo(base: string | null, fallback: string | null, days: number): Date | null {
  const src = base ?? fallback;
  if (!src) return null;
  const d = new Date(src);
  d.setDate(d.getDate() + days);
  return d;
}

function daysTo(d: Date | null): number | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return Math.round((x.getTime() - today.getTime()) / 86400000);
}

/** Next General (monthly) service date. */
export function generalServiceDate(asset: Asset): Date | null {
  return addDaysTo(
    asset.last_general_service_date,
    asset.installed_date,
    asset.general_interval_days || DEFAULT_GENERAL_DAYS
  );
}

/** Next Normal (quarterly) service date. */
export function normalServiceDate(asset: Asset): Date | null {
  return addDaysTo(
    asset.last_service_date,
    asset.installed_date,
    asset.service_interval_days || DEFAULT_NORMAL_DAYS
  );
}

export function generalDays(asset: Asset): number | null {
  return daysTo(generalServiceDate(asset));
}
export function normalDays(asset: Asset): number | null {
  return daysTo(normalServiceDate(asset));
}

/** The two service cadences, for display. */
export function serviceLines(asset: Asset): {
  kind: ServiceKind;
  date: Date | null;
  days: number | null;
}[] {
  return [
    { kind: "General", date: generalServiceDate(asset), days: generalDays(asset) },
    { kind: "Normal", date: normalServiceDate(asset), days: normalDays(asset) },
  ];
}

/** Soonest of the two service dates (keeps existing callers working). */
export function nextServiceDate(asset: Asset): Date | null {
  const g = generalServiceDate(asset);
  const n = normalServiceDate(asset);
  if (!g) return n;
  if (!n) return g;
  return g < n ? g : n;
}

/** Days until the soonest due service (negative = overdue). */
export function daysToService(asset: Asset): number | null {
  const vals = [generalDays(asset), normalDays(asset)].filter(
    (v): v is number => v !== null
  );
  if (vals.length === 0) return null;
  return Math.min(...vals);
}

/** Derived status, in priority order (see spec §4.4). */
export function assetStatus(asset: Asset): AssetStatus {
  if (asset.at_vendor) return "With CoolTech";
  if (asset.open_issue) return "Issue reported";
  const dts = daysToService(asset);
  if (dts !== null && dts <= 14) return "Service due";
  return "Healthy";
}

export function statusColor(status: AssetStatus): {
  bg: string;
  text: string;
  dot: string;
} {
  switch (status) {
    case "With CoolTech":
      return { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" };
    case "Issue reported":
      return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" };
    case "Service due":
      return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
    case "Healthy":
    default:
      return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
  }
}

/** Years of expected life remaining (may be negative). */
export function lifeLeftYears(asset: Asset): number | null {
  if (!asset.installed_date) return null;
  const installed = new Date(asset.installed_date);
  const end = new Date(installed);
  end.setFullYear(end.getFullYear() + (asset.expected_life_years || 10));
  const diffMs = end.getTime() - Date.now();
  return Math.round((diffMs / (365.25 * 86400000)) * 10) / 10;
}
