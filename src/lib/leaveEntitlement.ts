import { calculateApplicableLeaveDays } from './calendar';
import { getIndiaDateKey } from './attendanceDate';

export const MONTHLY_PAID_LEAVE_QUOTA = 1.5;

/**
 * Checks if two date ranges overlap in India business calendar.
 */
export function doLeaveDatesOverlap(
  start1: Date | string,
  end1: Date | string,
  start2: Date | string,
  end2: Date | string
): boolean {
  const s1 = getIndiaDateKey(start1);
  const e1 = getIndiaDateKey(end1);
  const s2 = getIndiaDateKey(start2);
  const e2 = getIndiaDateKey(end2);

  if (!s1 || !e1 || !s2 || !e2) return false;
  return s1 <= e2 && e1 >= s2;
}

/**
 * Finds any existing active/approved leave that conflicts with the requested date range.
 */
export function findConflictingLeave<
  T extends {
    id: string;
    startDate: Date | string;
    endDate: Date | string;
    currentStage: string;
    leaveType?: string;
  }
>(
  startDate: Date | string,
  endDate: Date | string,
  leaves: T[],
  options?: {
    excludeLeaveId?: string;
    allowedStages?: string[];
  }
): T | null {
  const { excludeLeaveId, allowedStages } = options || {};

  for (const leave of leaves) {
    if (excludeLeaveId && leave.id === excludeLeaveId) continue;
    if (leave.currentStage === 'REJECTED' || leave.currentStage === 'DELETED') continue;
    if (allowedStages && !allowedStages.includes(leave.currentStage)) continue;

    if (doLeaveDatesOverlap(startDate, endDate, leave.startDate, leave.endDate)) {
      return leave;
    }
  }

  return null;
}

export interface MonthLeaveSplit {
  monthKey: string; // "YYYY-MM"
  applicableDays: number;
  remainingBefore: number;
  paidDays: number;
  unpaidDays: number;
  remainingAfter: number;
}

export interface LeaveRequestSplitResult {
  totalApplicableDays: number;
  totalPaidDays: number;
  totalUnpaidDays: number;
  payTreatment: 'PAID' | 'UNPAID' | 'SPLIT';
  isEligible: boolean;
  monthSplits: MonthLeaveSplit[];
  monthAllocation: Record<string, { paid: number; unpaid: number }>;
  dayAllocations: Record<string, {
    dateKey: string;
    monthKey: string;
    dayName: string;
    isWorkingDay: boolean;
    countsAsLeave: boolean;
    payTreatment: 'PAID' | 'UNPAID' | 'SPLIT' | 'NONE';
    paidUnits: number;
    unpaidUnits: number;
  }>;
}

/**
 * Checks whether an employee is eligible for the 1.5-day monthly paid leave entitlement.
 * Rules:
 * - Full-Time Employees and Full-Time Team Leads are eligible.
 * - Interns are NOT eligible for the Full-Time entitlement (all unpaid by default).
 * - Managers are excluded from employee payroll/leave entitlement.
 */
export function isEligibleForMonthlyPaidLeave(user: {
  role?: string | null;
  employmentType?: string | null;
}): boolean {
  if (!user) return false;
  if (user.role === 'MANAGER') return false;
  if (user.employmentType === 'INTERN') return false;
  return true;
}

/**
 * Calculates the exact paid and unpaid split for a leave request based on the authoritative
 * 1.5 paid days per calendar month rule.
 *
 * Each month starts with a fresh 1.5-day entitlement.
 * Unused entitlement does not carry forward.
 * Usage in one month does not reduce the next month's entitlement.
 */
export function calculateLeaveRequestSplit(params: {
  user: {
    role?: string | null;
    employmentType?: string | null;
  };
  startDate: Date | string;
  endDate: Date | string;
  isHalfDay?: boolean;
  calendarOverrides?: Array<{
    dateKey: string;
    type: string;
    title?: string;
  }>;
  existingApprovedLeaves?: Array<{
    id: string;
    startDate: Date | string;
    endDate: Date | string;
    numberOfDays: number;
    paidDays?: number | null;
    unpaidDays?: number | null;
    payTreatment?: string | null;
    managerNote?: string | null;
    currentStage: string;
  }>;
  excludeLeaveId?: string;
}): LeaveRequestSplitResult {
  const {
    user,
    startDate,
    endDate,
    isHalfDay = false,
    calendarOverrides = [],
    existingApprovedLeaves = [],
    excludeLeaveId,
  } = params;

  const eligible = isEligibleForMonthlyPaidLeave(user);

  // 1. Calculate working days using authoritative Work Calendar
  const leaveCalc = calculateApplicableLeaveDays(startDate, endDate, calendarOverrides);
  const isSingleDay = leaveCalc.breakdown.length === 1;
  const isActualHalfDay = isHalfDay && isSingleDay;

  // 2. Group working leave days by month (YYYY-MM)
  const workingDaysByMonth = new Map<string, Array<(typeof leaveCalc.breakdown)[0]>>();
  for (const day of leaveCalc.breakdown) {
    if (day.countsAsLeave) {
      const monthKey = day.dateKey.substring(0, 7);
      if (!workingDaysByMonth.has(monthKey)) {
        workingDaysByMonth.set(monthKey, []);
      }
      workingDaysByMonth.get(monthKey)!.push(day);
    }
  }

  // Helper to compute approved paid leave days already consumed in a specific month
  const getApprovedPaidInMonth = (mKey: string): number => {
    let consumed = 0;
    const approvedList = existingApprovedLeaves.filter(
      (l) => l.currentStage === 'APPROVED' && l.id !== excludeLeaveId
    );

    for (const l of approvedList) {
      // Check if structured monthAllocation is stored in managerNote JSON
      let hasMonthAlloc = false;
      if (l.managerNote && l.managerNote.startsWith('{')) {
        try {
          const parsed = JSON.parse(l.managerNote);
          if (parsed.monthAllocation && parsed.monthAllocation[mKey]) {
            consumed += Number(parsed.monthAllocation[mKey].paid) || 0;
            hasMonthAlloc = true;
          }
        } catch {}
      }

      if (!hasMonthAlloc) {
        const lStartKey = getIndiaDateKey(l.startDate);
        const lEndKey = getIndiaDateKey(l.endDate);
        const lStartMonth = lStartKey.substring(0, 7);
        const lEndMonth = lEndKey.substring(0, 7);

        // If leave falls entirely in this month
        if (lStartMonth === mKey && lEndMonth === mKey) {
          if (l.paidDays !== null && l.paidDays !== undefined) {
            consumed += Number(l.paidDays) || 0;
          } else if (l.payTreatment === 'PAID') {
            consumed += Number(l.numberOfDays) || 0;
          }
        } else if (lStartMonth <= mKey && lEndMonth >= mKey) {
          // Cross-month fallback
          if (l.paidDays !== null && l.paidDays !== undefined) {
            consumed += Math.min(MONTHLY_PAID_LEAVE_QUOTA, Number(l.paidDays) || 0);
          } else if (l.payTreatment === 'PAID') {
            consumed += Math.min(MONTHLY_PAID_LEAVE_QUOTA, Number(l.numberOfDays) || 0);
          }
        }
      }
    }

    return Math.min(MONTHLY_PAID_LEAVE_QUOTA, Math.round(consumed * 10) / 10);
  };

  const monthSplits: MonthLeaveSplit[] = [];
  const monthAllocation: Record<string, { paid: number; unpaid: number }> = {};
  const dayAllocations: LeaveRequestSplitResult['dayAllocations'] = {};

  let totalApplicableDays = 0;
  let totalPaidDays = 0;
  let totalUnpaidDays = 0;

  // Process each month in sorted chronological order
  const sortedMonthKeys = Array.from(workingDaysByMonth.keys()).sort();

  for (const mKey of sortedMonthKeys) {
    const daysInMonth = workingDaysByMonth.get(mKey)!;
    const baseMonthDays = isActualHalfDay ? 0.5 : daysInMonth.length;
    totalApplicableDays += baseMonthDays;

    if (!eligible) {
      // Ineligible (e.g. Intern) -> 100% Unpaid
      monthSplits.push({
        monthKey: mKey,
        applicableDays: baseMonthDays,
        remainingBefore: 0,
        paidDays: 0,
        unpaidDays: baseMonthDays,
        remainingAfter: 0,
      });
      monthAllocation[mKey] = { paid: 0, unpaid: baseMonthDays };
      totalUnpaidDays += baseMonthDays;

      for (const d of daysInMonth) {
        dayAllocations[d.dateKey] = {
          dateKey: d.dateKey,
          monthKey: mKey,
          dayName: d.dayName,
          isWorkingDay: d.isWorkingDay,
          countsAsLeave: true,
          payTreatment: 'UNPAID',
          paidUnits: 0,
          unpaidUnits: isActualHalfDay ? 0.5 : 1.0,
        };
      }
      continue;
    }

    const previouslyConsumed = getApprovedPaidInMonth(mKey);
    let remaining = Math.max(0, Math.round((MONTHLY_PAID_LEAVE_QUOTA - previouslyConsumed) * 10) / 10);
    const remainingBefore = remaining;

    let monthPaid = 0;
    let monthUnpaid = 0;

    for (let i = 0; i < daysInMonth.length; i++) {
      const d = daysInMonth[i];
      const dayReqUnits = isActualHalfDay ? 0.5 : 1.0;

      let dayPaidUnits = 0;
      let dayUnpaidUnits = 0;

      if (dayReqUnits === 0.5) {
        if (remaining >= 0.5) {
          dayPaidUnits = 0.5;
          remaining = Math.max(0, Math.round((remaining - 0.5) * 10) / 10);
        } else {
          dayUnpaidUnits = 0.5;
        }
      } else {
        // 1.0 full day
        if (remaining >= 1.0) {
          dayPaidUnits = 1.0;
          remaining = Math.max(0, Math.round((remaining - 1.0) * 10) / 10);
        } else if (remaining === 0.5) {
          dayPaidUnits = 0.5;
          dayUnpaidUnits = 0.5;
          remaining = 0;
        } else {
          dayUnpaidUnits = 1.0;
        }
      }

      monthPaid += dayPaidUnits;
      monthUnpaid += dayUnpaidUnits;

      dayAllocations[d.dateKey] = {
        dateKey: d.dateKey,
        monthKey: mKey,
        dayName: d.dayName,
        isWorkingDay: d.isWorkingDay,
        countsAsLeave: true,
        payTreatment: dayUnpaidUnits === 0 ? 'PAID' : dayPaidUnits === 0 ? 'UNPAID' : 'SPLIT',
        paidUnits: dayPaidUnits,
        unpaidUnits: dayUnpaidUnits,
      };
    }

    monthPaid = Math.round(monthPaid * 10) / 10;
    monthUnpaid = Math.round(monthUnpaid * 10) / 10;

    monthSplits.push({
      monthKey: mKey,
      applicableDays: baseMonthDays,
      remainingBefore,
      paidDays: monthPaid,
      unpaidDays: monthUnpaid,
      remainingAfter: remaining,
    });

    monthAllocation[mKey] = { paid: monthPaid, unpaid: monthUnpaid };
    totalPaidDays += monthPaid;
    totalUnpaidDays += monthUnpaid;
  }

  // Include non-working days in dayAllocations for complete mapping
  for (const day of leaveCalc.breakdown) {
    if (!day.countsAsLeave) {
      const monthKey = day.dateKey.substring(0, 7);
      dayAllocations[day.dateKey] = {
        dateKey: day.dateKey,
        monthKey,
        dayName: day.dayName,
        isWorkingDay: day.isWorkingDay,
        countsAsLeave: false,
        payTreatment: 'NONE',
        paidUnits: 0,
        unpaidUnits: 0,
      };
    }
  }

  totalApplicableDays = Math.round(totalApplicableDays * 10) / 10;
  totalPaidDays = Math.round(totalPaidDays * 10) / 10;
  totalUnpaidDays = Math.round(totalUnpaidDays * 10) / 10;

  let payTreatment: 'PAID' | 'UNPAID' | 'SPLIT' = 'PAID';
  if (totalPaidDays > 0 && totalUnpaidDays > 0) {
    payTreatment = 'SPLIT';
  } else if (totalUnpaidDays > 0 && totalPaidDays === 0) {
    payTreatment = 'UNPAID';
  } else {
    payTreatment = 'PAID';
  }

  return {
    totalApplicableDays,
    totalPaidDays,
    totalUnpaidDays,
    payTreatment,
    isEligible: eligible,
    monthSplits,
    monthAllocation,
    dayAllocations,
  };
}
