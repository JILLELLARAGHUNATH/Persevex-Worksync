import { getIndiaDateKey, getTodayIndiaDateKey, getYesterdayIndiaDateKey, getIndiaWorkdayInfo } from './attendanceDate';

export type LeaveDatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'DATE';

export interface DateRangeResult {
  startRangeKey: string | null;
  endRangeKey: string | null;
}

/**
 * Calculates start and end YYYY-MM-DD date range keys in Asia/Kolkata timezone.
 */
export function getLeaveFilterDateRange(
  preset: LeaveDatePreset,
  selectedDate?: string,
  now: Date = new Date()
): DateRangeResult {
  if (preset === 'ALL') {
    return { startRangeKey: null, endRangeKey: null };
  }

  const todayKey = getTodayIndiaDateKey(now);

  if (preset === 'TODAY') {
    return { startRangeKey: todayKey, endRangeKey: todayKey };
  }

  if (preset === 'YESTERDAY') {
    const yesterdayKey = getYesterdayIndiaDateKey(now);
    return { startRangeKey: yesterdayKey, endRangeKey: yesterdayKey };
  }

  if (preset === 'DATE') {
    const k = selectedDate || todayKey;
    return { startRangeKey: k, endRangeKey: k };
  }

  const india = getIndiaWorkdayInfo(now);

  if (preset === 'WEEK') {
    // Current Indian week: Monday to Sunday
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday ...
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(Date.UTC(india.year, india.month - 1, india.day - distanceToMonday, 12, 0, 0, 0));
    const sunday = new Date(Date.UTC(india.year, india.month - 1, india.day - distanceToMonday + 6, 12, 0, 0, 0));
    return {
      startRangeKey: getIndiaDateKey(monday),
      endRangeKey: getIndiaDateKey(sunday),
    };
  }

  if (preset === 'MONTH') {
    const startOfMonth = new Date(Date.UTC(india.year, india.month - 1, 1, 12, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(india.year, india.month, 0, 12, 0, 0, 0));
    return {
      startRangeKey: getIndiaDateKey(startOfMonth),
      endRangeKey: getIndiaDateKey(endOfMonth),
    };
  }

  return { startRangeKey: null, endRangeKey: null };
}

/**
 * Validates whether a leave request (startDate to endDate) overlaps with the chosen date range.
 * 
 * Formal Rule:
 * leaveStartDate <= selectedRangeEnd && leaveEndDate >= selectedRangeStart
 */
export function doesLeaveOverlapRange(
  startDateInput: Date | string,
  endDateInput: Date | string,
  startRangeKey: string | null,
  endRangeKey: string | null
): boolean {
  if (!startRangeKey && !endRangeKey) {
    return true; // All Dates matches everything
  }

  const leaveStartKey = getIndiaDateKey(startDateInput);
  const leaveEndKey = getIndiaDateKey(endDateInput);

  if (!leaveStartKey || !leaveEndKey) return true;

  if (startRangeKey && endRangeKey) {
    return leaveStartKey <= endRangeKey && leaveEndKey >= startRangeKey;
  }

  if (startRangeKey) {
    return leaveEndKey >= startRangeKey;
  }

  if (endRangeKey) {
    return leaveStartKey <= endRangeKey;
  }

  return true;
}
