// Date helpers that work on plain YYYY-MM-DD strings (no timezone surprises).

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISO(value);
  return todayISO(date) === value;
}

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Next occurrence of a weekday strictly after `fromISO` (so "Friday" on a Friday means next week). */
export function nextWeekday(fromISO: string, weekday: number): string {
  const date = parseISO(fromISO);
  const diff = (weekday - date.getDay() + 7) % 7 || 7;
  return addDays(fromISO, diff);
}

export function endOfMonth(fromISO: string): string {
  const date = parseISO(fromISO);
  return todayISO(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = iso.length > 10 ? new Date(iso) : parseISO(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO).getTime() - parseISO(fromISO).getTime()) / 86_400_000);
}
