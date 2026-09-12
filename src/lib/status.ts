import type { Asset, AssetStatus } from "./types";

/** Next service date derived from last service + interval. */
export function nextServiceDate(asset: Asset): Date | null {
  if (!asset.last_service_date) {
    // Never serviced: fall back to installed date + interval, else unknown.
    if (!asset.installed_date) return null;
    const d = new Date(asset.installed_date);
    d.setDate(d.getDate() + (asset.service_interval_days || 90));
    return d;
  }
  const d = new Date(asset.last_service_date);
  d.setDate(d.getDate() + (asset.service_interval_days || 90));
  return d;
}

/** Days until next service (negative = overdue). */
export function daysToService(asset: Asset): number | null {
  const next = nextServiceDate(asset);
  if (!next) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  next.setHours(0, 0, 0, 0);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
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
