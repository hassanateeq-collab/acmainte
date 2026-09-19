import type { Asset, AssetStatus } from "./types";

export type ServiceKind = "General" | "Master";

const DEFAULT_GENERAL_DAYS = 90; // General service — every 3 months
const DEFAULT_MASTER_DAYS = 365; // Master service — yearly
export const GRACE_DAYS = 7; // a due service stays "due" for this many days, then rolls + counts a miss

function midnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function dayDiff(from: Date, to: Date): number {
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / 86400000);
}

export type ServiceState = {
  nextDue: Date | null; // current active due date (rolled past any missed windows)
  days: number | null; // days from today until nextDue (<= 0 means inside the due window)
  dueNow: boolean; // today is inside [nextDue, nextDue + grace]
  daysLeftInWindow: number | null; // days left before this one is missed too
  missed: number; // cycles missed since the base date (derived)
  missedDates: Date[]; // the due dates that were missed
};

/**
 * Rolling service state. A cycle is "missed" once its due date + grace has fully
 * passed; the clock then rolls to the next cycle. Purely derived from the base
 * (last-service or installed) date + interval, so it needs no background job.
 */
export function serviceState(
  base: string | null,
  installed: string | null,
  interval: number,
  asOf?: Date
): ServiceState {
  const src = base ?? installed;
  if (!src) {
    return { nextDue: null, days: null, dueNow: false, daysLeftInWindow: null, missed: 0, missedDates: [] };
  }
  const start = midnight(new Date(src));
  const today = midnight(asOf ?? new Date());
  const iv = interval > 0 ? interval : 1;

  let missed = 0;
  const missedDates: Date[] = [];
  while (missed < 5000) {
    const due = addDays(start, (missed + 1) * iv);
    if (today.getTime() > addDays(due, GRACE_DAYS).getTime()) {
      missedDates.push(due);
      missed++;
    } else break;
  }
  const nextDue = addDays(start, (missed + 1) * iv);
  const days = dayDiff(today, nextDue);
  const dueNow = today.getTime() >= nextDue.getTime();
  const daysLeftInWindow = dueNow ? GRACE_DAYS + days : null; // days = negative inside window
  return { nextDue, days, dueNow, daysLeftInWindow, missed, missedDates };
}

export function generalState(a: Asset): ServiceState {
  return serviceState(a.last_general_service_date, a.installed_date, a.general_interval_days || DEFAULT_GENERAL_DAYS);
}
export function masterState(a: Asset): ServiceState {
  return serviceState(a.last_service_date, a.installed_date, a.service_interval_days || DEFAULT_MASTER_DAYS);
}

export function generalServiceDate(a: Asset): Date | null {
  return generalState(a).nextDue;
}
export function masterServiceDate(a: Asset): Date | null {
  return masterState(a).nextDue;
}
export function generalDays(a: Asset): number | null {
  return generalState(a).days;
}
export function masterDays(a: Asset): number | null {
  return masterState(a).days;
}

/** Total missed = persisted (recorded at service time) + currently-outstanding (derived). */
export function generalMissed(a: Asset): number {
  return (a.general_missed || 0) + generalState(a).missed;
}
export function masterMissed(a: Asset): number {
  return (a.master_missed || 0) + masterState(a).missed;
}
export function totalMissed(a: Asset): number {
  return generalMissed(a) + masterMissed(a);
}

/** Soonest of the two service dates (keeps existing callers working). */
export function nextServiceDate(a: Asset): Date | null {
  const g = generalServiceDate(a);
  const m = masterServiceDate(a);
  if (!g) return m;
  if (!m) return g;
  return g < m ? g : m;
}

/** Days until the soonest active due date. */
export function daysToService(a: Asset): number | null {
  const vals = [generalDays(a), masterDays(a)].filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return Math.min(...vals);
}

/** Derived status. A service shows "due" only while inside its 7-day window. */
export function assetStatus(asset: Asset): AssetStatus {
  if (asset.at_vendor) return "With CoolTech";
  if (asset.open_issue) return "Issue reported";
  if (generalState(asset).dueNow || masterState(asset).dueNow) return "Service due";
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
