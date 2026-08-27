/**
 * Timezone-safe date & workday utility for Persevex WorkSync.
 * 
 * Standard Business Timezone: Asia/Kolkata (IST = UTC + 5:30)
 * 
 * Guarantees 100% identical date and attendance behavior on:
 * 1. Localhost development (any local timezone)
 * 2. Vercel serverless production (UTC runtime)
 */

export interface IndiaWorkdayInfo {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;// 0-59
  second: number;// 0-59
  dateKey: string; // "YYYY-MM-DD" in Asia/Kolkata
  startOfDayIST: Date; // UTC representation of 00:00:00.000 IST
  endOfDayIST: Date;   // UTC representation of 23:59:59.999 IST
  canonicalDate: Date; // Normalized date representing this Indian workday
}

/**
 * Extracts date and time components for a given timestamp in Asia/Kolkata timezone.
 */
export function getIndiaWorkdayInfo(inputDate: Date = new Date()): IndiaWorkdayInfo {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(inputDate);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // In Indian Standard Time (UTC + 5:30):
  // 00:00:00 IST of YYYY-MM-DD is Date.UTC(year, month - 1, day, -5, -30, 0, 0)
  // which is equivalent to previous UTC day 18:30:00.000Z.
  const startOfDayIST = new Date(Date.UTC(year, month - 1, day, -5, -30, 0, 0));
  const endOfDayIST = new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));

  // Canonical date used for @@unique([userId, date]) in Prisma
  const canonicalDate = startOfDayIST;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateKey,
    startOfDayIST,
    endOfDayIST,
    canonicalDate,
  };
}

/**
 * Returns a timezone-safe "YYYY-MM-DD" key in Asia/Kolkata for any Date, string, or number.
 */
export function getIndiaDateKey(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Checks if two timestamps represent the same Indian business day.
 */
export function isSameIndiaWorkday(
  dateA: Date | string | number | null | undefined,
  dateB: Date | string | number | null | undefined
): boolean {
  const keyA = getIndiaDateKey(dateA);
  const keyB = getIndiaDateKey(dateB);
  return Boolean(keyA && keyB && keyA === keyB);
}
