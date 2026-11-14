/**
 * Calendar-date helpers. All document dates are plain `YYYY-MM-DD` calendar
 * dates (no time, no timezone). Month grouping uses the `YYYY-MM` prefix so
 * results never shift across timezones.
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** True when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  // Day 0 of the next month = number of days in month m.
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

/**
 * The date used for month grouping and display:
 * the explicit document date, else the UTC calendar date of the upload.
 */
export function effectiveDateOf(doc: {
  documentDate: string | null;
  createdAt: string;
}): string {
  return doc.documentDate ?? utcDateOfTimestamp(doc.createdAt);
}

/** UTC calendar date (`YYYY-MM-DD`) of an ISO timestamp. */
export function utcDateOfTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

/** `YYYY-MM` key of a `YYYY-MM-DD` date. */
export function monthKey(dateYmd: string): string {
  return dateYmd.slice(0, 7);
}

/** `YYYY-MM` key for a (month, year) pair. */
export function monthKeyFor(month: number, year: number): string {
  return `${year}-${pad2(month)}`;
}

export function monthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function zipFilename(month: number, year: number): string {
  return `BusinessVault_${MONTH_NAMES[month - 1]}_${year}.zip`;
}

/** Human display of a date or timestamp: `14 Nov 2026`. */
export function formatDateDisplay(value: string): string {
  const d = value.slice(0, 10);
  if (!isValidCalendarDate(d)) return value;
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTH_NAMES_SHORT[m - 1]} ${y}`;
}

/** Today's calendar date in UTC (`YYYY-MM-DD`). */
export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
