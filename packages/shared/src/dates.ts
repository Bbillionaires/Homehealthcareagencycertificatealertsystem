/**
 * Calendar-date-safe helpers. Dates are plain `YYYY-MM-DD` strings (no time
 * component) so a "2 years" renewal is calendar math, not 365*2 days —
 * that distinction matters across leap years and month-length differences.
 */

export type IntervalUnit = "days" | "months" | "years";

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export function parseDate(value: string): CalendarDate {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date string: ${value}`);
  }
  return { year, month, day };
}

export function formatDate({ year, month, day }: CalendarDate): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function daysInMonth(year: number, month: number): number {
  // month is 1-12; day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toUtcTimestamp({ year, month, day }: CalendarDate): number {
  return Date.UTC(year, month - 1, day);
}

/**
 * Adds a renewal interval to a completion/issue date using calendar
 * arithmetic. Adding months/years clamps the day-of-month to the last valid
 * day of the target month (e.g. Jan 31 + 1 month -> Feb 28/29), matching
 * common calendar-date conventions rather than overflowing into the month
 * after.
 */
export function addCalendarInterval(
  dateString: string,
  value: number,
  unit: IntervalUnit
): string {
  const date = parseDate(dateString);

  if (unit === "days") {
    const ts = toUtcTimestamp(date) + value * 86_400_000;
    const d = new Date(ts);
    return formatDate({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    });
  }

  const totalMonths = unit === "years" ? value * 12 : value;
  const absoluteMonth = (date.month - 1) + totalMonths;
  const year = date.year + Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12 + 1;
  const day = Math.min(date.day, daysInMonth(year, month));

  return formatDate({ year, month, day });
}

/** Whole days from `fromDate` to `toDate` (positive = toDate is later). */
export function daysBetween(fromDate: string, toDate: string): number {
  const a = toUtcTimestamp(parseDate(fromDate));
  const b = toUtcTimestamp(parseDate(toDate));
  return Math.round((b - a) / 86_400_000);
}

/** Today as a `YYYY-MM-DD` string in UTC. Accepts an override for tests. */
export function todayIso(reference: Date = new Date()): string {
  return formatDate({
    year: reference.getUTCFullYear(),
    month: reference.getUTCMonth() + 1,
    day: reference.getUTCDate(),
  });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Human-readable long date, e.g. "September 8, 2026". */
export function formatDateLong(dateString: string): string {
  const { year, month, day } = parseDate(dateString);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}
