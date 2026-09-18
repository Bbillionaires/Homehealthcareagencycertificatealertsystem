/**
 * Calendar-grid date math for the compliance calendar (month/week/day
 * views). Kept separate from packages/shared's date helpers since this
 * is UI grid layout, not compliance/renewal logic -- but uses the same
 * UTC-based, timezone-agnostic approach.
 */

export function todayIso(): string {
  const d = new Date();
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function fromIso(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function toUtcDate(date: string): Date {
  const { year, month, day } = fromIso(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(d: Date): string {
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: string, days: number): string {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

export function addMonths(date: string, months: number): string {
  const { year, month, day } = fromIso(date);
  const d = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fromUtcDate(d);
}

/** Sunday-starting 6-week (42 day) grid covering the whole month containing `date`. */
export function getMonthGrid(date: string): string[] {
  const { year, month } = fromIso(date);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = firstOfMonth.getUTCDay(); // 0 = Sunday
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - startOffset);

  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    days.push(fromUtcDate(d));
  }
  return days;
}

/** Sunday-starting 7 days covering the week containing `date`. */
export function getWeekDays(date: string): string[] {
  const d = toUtcDate(date);
  const startOffset = d.getUTCDay();
  const weekStart = new Date(d);
  weekStart.setUTCDate(d.getUTCDate() - startOffset);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setUTCDate(weekStart.getUTCDate() + i);
    days.push(fromUtcDate(day));
  }
  return days;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthLabel(date: string): string {
  const { year, month } = fromIso(date);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function dayOfMonth(date: string): number {
  return fromIso(date).day;
}

export function isSameMonth(date: string, reference: string): boolean {
  const a = fromIso(date);
  const b = fromIso(reference);
  return a.year === b.year && a.month === b.month;
}

export function longLabel(date: string): string {
  const { year, month, day } = fromIso(date);
  return `${DAY_NAMES[toUtcDate(date).getUTCDay()]}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export function weekdayNames(): string[] {
  return DAY_NAMES;
}
