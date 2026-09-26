import { getIndiaDateKey, getIndiaWorkdayInfo } from './attendanceDate';

export type CalendarDayStatus =
  | 'WORKING_DAY'
  | 'WEEKLY_OFF'
  | 'COMPANY_HOLIDAY'
  | 'SPECIAL_WORKING_DAY';

export interface CalendarDayInfo {
  dayNumber: number;
  dateKey: string; // "YYYY-MM-DD"
  canonicalDate: Date;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  dayName: string;
  status: CalendarDayStatus;
  isWeeklyOff: boolean;
  isCompanyHoliday: boolean;
  isSpecialWorkingDay: boolean;
  isWorkingDay: boolean;
  overrideEntry?: {
    id: string;
    type: string;
    title: string;
    description?: string | null;
  } | null;
  leaves?: Array<{
    id: string;
    userId: string;
    userName?: string;
    employeeId?: string;
    teamName?: string;
    userRole?: string;
    leaveType: string;
    currentStage: string;
    payTreatment?: string | null;
    numberOfDays: number;
    reason: string;
  }>;
  attendance?: {
    id?: string;
    status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'PENDING';
    checkInTime: string | null;
    checkOutTime: string | null;
    totalHours: number;
    isPunchedIn: boolean;
    classification: string;
  } | null;
  attendanceSummary?: {
    presentCount: number;
    absentCount: number;
    halfDayCount: number;
    pendingCount: number;
  } | null;
}

export interface MonthCalendarSummary {
  year: number;
  month: number;
  monthKey: string; // "YYYY-MM"
  calendarDaysCount: number;
  weeklyOffsCount: number;
  companyHolidaysCount: number;
  specialWorkingDaysCount: number;
  workingDaysCount: number;
  presentDaysCount?: number;
  absentDaysCount?: number;
  halfDaysCount?: number;
  days: CalendarDayInfo[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculates the applicable working leave days for a date range based on the authoritative Work Calendar.
 * Rules:
 * - Wednesday is Weekly Off by default (0 leave days consumed).
 * - Company Holiday (override) (0 leave days consumed).
 * - Special Working Day (override) (1.0 working leave day consumed).
 * - Normal Working Day (Mon, Tue, Thu, Fri, Sat, Sun) (1.0 working leave day consumed).
 */
export function calculateApplicableLeaveDays(
  startDateInput: Date | string,
  endDateInput: Date | string,
  calendarOverrides: Array<{
    dateKey: string;
    type: string;
    title?: string;
  }> = []
): {
  totalCalendarDays: number;
  applicableLeaveDays: number;
  weeklyOffDaysCount: number;
  holidayDaysCount: number;
  specialWorkingDaysCount: number;
  workingDaysCount: number;
  breakdown: Array<{
    dateKey: string;
    dayName: string;
    status: CalendarDayStatus;
    isWorkingDay: boolean;
    isWeeklyOff: boolean;
    isCompanyHoliday: boolean;
    isSpecialWorkingDay: boolean;
    countsAsLeave: boolean;
  }>;
} {
  const startKey = getIndiaDateKey(startDateInput);
  const endKey = getIndiaDateKey(endDateInput);

  if (!startKey || !endKey || startKey > endKey) {
    return {
      totalCalendarDays: 0,
      applicableLeaveDays: 0,
      weeklyOffDaysCount: 0,
      holidayDaysCount: 0,
      specialWorkingDaysCount: 0,
      workingDaysCount: 0,
      breakdown: [],
    };
  }

  const overridesMap = new Map<string, (typeof calendarOverrides)[0]>();
  for (const entry of calendarOverrides) {
    overridesMap.set(entry.dateKey, entry);
  }

  const startDate = new Date(startKey + 'T00:00:00.000Z');
  const endDate = new Date(endKey + 'T00:00:00.000Z');

  const breakdown: Array<{
    dateKey: string;
    dayName: string;
    status: CalendarDayStatus;
    isWorkingDay: boolean;
    isWeeklyOff: boolean;
    isCompanyHoliday: boolean;
    isSpecialWorkingDay: boolean;
    countsAsLeave: boolean;
  }> = [];

  let totalCalendarDays = 0;
  let applicableLeaveDays = 0;
  let weeklyOffDaysCount = 0;
  let holidayDaysCount = 0;
  let specialWorkingDaysCount = 0;
  let workingDaysCount = 0;

  const curr = new Date(startDate);
  while (curr <= endDate) {
    const dateKey = curr.toISOString().split('T')[0];
    const dayOfWeek = curr.getUTCDay();
    const dayName = DAY_NAMES[dayOfWeek];
    const override = overridesMap.get(dateKey);

    let status: CalendarDayStatus = 'WORKING_DAY';
    let isWeeklyOff = false;
    let isCompanyHoliday = false;
    let isSpecialWorkingDay = false;
    let isWorkingDay = false;

    if (override && override.type === 'COMPANY_HOLIDAY') {
      status = 'COMPANY_HOLIDAY';
      isCompanyHoliday = true;
      holidayDaysCount++;
    } else if (override && override.type === 'SPECIAL_WORKING_DAY') {
      status = 'SPECIAL_WORKING_DAY';
      isSpecialWorkingDay = true;
      isWorkingDay = true;
      specialWorkingDaysCount++;
      workingDaysCount++;
      applicableLeaveDays += 1.0;
    } else if (dayOfWeek === 3) {
      status = 'WEEKLY_OFF';
      isWeeklyOff = true;
      weeklyOffDaysCount++;
    } else {
      status = 'WORKING_DAY';
      isWorkingDay = true;
      workingDaysCount++;
      applicableLeaveDays += 1.0;
    }

    totalCalendarDays++;
    breakdown.push({
      dateKey,
      dayName,
      status,
      isWorkingDay,
      isWeeklyOff,
      isCompanyHoliday,
      isSpecialWorkingDay,
      countsAsLeave: isWorkingDay,
    });

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return {
    totalCalendarDays,
    applicableLeaveDays,
    weeklyOffDaysCount,
    holidayDaysCount,
    specialWorkingDaysCount,
    workingDaysCount,
    breakdown,
  };
}

/**
 * Builds full timezone-safe calendar structure for a given month and year in IST.
 * Standard rule: Wednesday = Weekly Off; all other 6 days = Working Day.
 * CompanyCalendar entries override defaults:
 * - COMPANY_HOLIDAY overrides any day (working or weekly off)
 * - SPECIAL_WORKING_DAY overrides Wednesday Weekly Off (or sets special working day)
 */
export function buildMonthWorkCalendar(
  year: number,
  month: number, // 1 - 12
  calendarOverrides: Array<{
    id: string;
    dateKey: string;
    type: string;
    title: string;
    description?: string | null;
  }> = []
): MonthCalendarSummary {
  const overridesMap = new Map<string, (typeof calendarOverrides)[0]>();
  for (const entry of calendarOverrides) {
    overridesMap.set(entry.dateKey, entry);
  }

  // Days in month
  const totalDays = new Date(year, month, 0).getDate();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const days: CalendarDayInfo[] = [];
  let weeklyOffsCount = 0;
  let companyHolidaysCount = 0;
  let specialWorkingDaysCount = 0;
  let workingDaysCount = 0;

  for (let day = 1; day <= totalDays; day++) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    // Determine day of week in IST
    const dayOfWeek = dateObj.getUTCDay();
    const dayName = DAY_NAMES[dayOfWeek];

    const override = overridesMap.get(dateKey) || null;

    let status: CalendarDayStatus = 'WORKING_DAY';
    let isWeeklyOff = false;
    let isCompanyHoliday = false;
    let isSpecialWorkingDay = false;
    let isWorkingDay = false;

    if (override && override.type === 'COMPANY_HOLIDAY') {
      status = 'COMPANY_HOLIDAY';
      isCompanyHoliday = true;
      companyHolidaysCount++;
    } else if (override && override.type === 'SPECIAL_WORKING_DAY') {
      status = 'SPECIAL_WORKING_DAY';
      isSpecialWorkingDay = true;
      isWorkingDay = true;
      specialWorkingDaysCount++;
      workingDaysCount++;
    } else if (dayOfWeek === 3) {
      // Wednesday is the standard weekly off for Persevex
      status = 'WEEKLY_OFF';
      isWeeklyOff = true;
      weeklyOffsCount++;
    } else {
      status = 'WORKING_DAY';
      isWorkingDay = true;
      workingDaysCount++;
    }

    days.push({
      dayNumber: day,
      dateKey,
      canonicalDate: dateObj,
      dayOfWeek,
      dayName,
      status,
      isWeeklyOff,
      isCompanyHoliday,
      isSpecialWorkingDay,
      isWorkingDay,
      overrideEntry: override,
      leaves: [],
      attendance: null,
      attendanceSummary: null,
    });
  }

  return {
    year,
    month,
    monthKey,
    calendarDaysCount: totalDays,
    weeklyOffsCount,
    companyHolidaysCount,
    specialWorkingDaysCount,
    workingDaysCount,
    days,
  };
}

/**
 * Attaches leave records to calendar days.
 * If a date is a Company Holiday, it remains marked as Company Holiday,
 * while still displaying the leave badge with status to the user for visibility.
 */
export function attachLeavesToCalendar(
  days: CalendarDayInfo[],
  leaves: Array<{
    id: string;
    userId: string;
    user?: { fullName?: string; employeeId?: string; role?: string; team?: { name?: string } };
    startDate: Date | string;
    endDate: Date | string;
    leaveType: string;
    currentStage: string;
    payTreatment?: string | null;
    numberOfDays: number;
    reason: string;
  }>
): CalendarDayInfo[] {
  for (const day of days) {
    const dayKey = day.dateKey;
    const dayLeaves = leaves.filter((leave) => {
      const startKey = getIndiaDateKey(leave.startDate);
      const endKey = getIndiaDateKey(leave.endDate);
      return dayKey >= startKey && dayKey <= endKey;
    });

    day.leaves = dayLeaves.map((l) => ({
      id: l.id,
      userId: l.userId,
      userName: l.user?.fullName,
      employeeId: l.user?.employeeId,
      teamName: l.user?.team?.name,
      userRole: l.user?.role,
      leaveType: l.leaveType,
      currentStage: l.currentStage,
      payTreatment: l.payTreatment,
      numberOfDays: l.numberOfDays,
      reason: l.reason,
    }));
  }

  return days;
}
