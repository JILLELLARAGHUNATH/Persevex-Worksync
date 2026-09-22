import { buildMonthWorkCalendar, MonthCalendarSummary } from './calendar';
import { getIndiaDateKey } from './attendanceDate';
import { classifyAttendanceHours } from './attendanceClassification';

export interface EmployeePayrollCalculation {
  userId: string;
  fullName: string;
  employeeId: string;
  teamName: string;
  employmentType: string;
  baseSalary: number; // Stored active base salary or weighted monthly rate
  salaryEffectiveFrom: Date | string | null;
  salaryRecordsCount: number;
  calendarDays: number;
  weeklyOffs: number;
  companyHolidays: number;
  specialWorkingDays: number;
  workingDays: number; // Total company working days in month
  employeeWorkingDays: number; // Working days within employee active tenure
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  pendingLeaveDays: number;
  rejectedLeaveDays: number;
  dailyRate: number; // Weighted average daily rate or standard daily rate
  presentAndPaidLeaveSalary?: number; // (Present + Paid Leave) × Daily Rate
  weekOffAndHolidaySalary?: number; // (Weekly Off + Company Holiday) × Daily Rate
  unpaidDeduction: number;
  finalPayable: number;
  status: 'DRAFT' | 'CALCULATED' | 'FINALIZED' | 'RECALCULATION_REQUIRED';
  notes?: string | null;
  dayByDayBreakdown: Array<{
    dateKey: string;
    dayNumber: number;
    dayName: string;
    dayStatus: string; // WORKING_DAY | WEEKLY_OFF | COMPANY_HOLIDAY | SPECIAL_WORKING_DAY | OUT_OF_TENURE
    attendanceStatus: string | null; // PRESENT | HALF_DAY | ABSENT | null
    leaveStatus: string | null; // PAID | UNPAID | PENDING | REJECTED | null
    leaveType: string | null;
    isDeducted: boolean;
    deductionUnits: number; // 0, 0.5, 1.0
    dayDailyRate: number;
    dayBaseSalary: number;
  }>;
}

export interface MonthPayrollSummary {
  year: number;
  month: number;
  monthKey: string;
  totalEmployees: number;
  totalMonthlySalary: number;
  totalPayableSalary: number;
  totalPaidLeaveDays: number;
  totalUnpaidDays: number;
  applicableWorkingDays?: number;
  calendarDaysCount?: number;
  status: 'DRAFT' | 'CALCULATED' | 'FINALIZED' | 'RECALCULATION_REQUIRED';
  employees: EmployeePayrollCalculation[];
}

/**
 * Calculates authoritative month payroll for an employee based on company calendar,
 * attendance records, leave requests with pay treatment, and salary history.
 *
 * Rules:
 * 1. Base Salary comes strictly from DB SalaryRecords. If no record exists, baseSalary = 0.
 * 2. Mid-month salary revisions: Evaluated per calendar day based on salary active on that exact date.
 * 3. Daily Rate: Monthly Salary / Number of Calendar Days in Month (e.g. Sep = 30 days, ₹30,000 / 30 = ₹1,000).
 * 4. Tenure: Days before joiningDate or after exitDate are OUT_OF_TENURE (0 working days, 0 pay, 0 deduction).
 * 5. Weekly Offs and Company Holidays create 0 unpaid days and 0 deduction.
 * 6. Approved Paid Leaves create 0 deduction.
 * 7. Approved Unpaid Leaves and unexplained absences create unpaid deduction = units * Daily Rate.
 * 8. All counts are bounded: unpaidLeaveDays >= 0, presentDays >= 0, finalPayable >= 0.
 */
export function calculateEmployeePayroll(params: {
  user: {
    id: string;
    fullName: string;
    employeeId: string;
    employmentType?: string | null;
    joiningDate?: Date | string | null;
    exitDate?: Date | string | null;
    team?: { name?: string } | null;
  };
  calendarSummary: MonthCalendarSummary;
  salaryRecords: Array<{
    id: string;
    baseSalary: number;
    employmentType: string;
    effectiveFrom: Date | string;
    effectiveTo?: Date | string | null;
  }>;
  attendances: Array<{
    id: string;
    date: Date | string;
    status: string; // PRESENT | ABSENT | HALF_DAY | ON_LEAVE
    checkInTime?: Date | string | null;
    checkOutTime?: Date | string | null;
    totalHours?: number | null;
  }>;
  leaveRequests: Array<{
    id: string;
    startDate: Date | string;
    endDate: Date | string;
    leaveType: string;
    currentStage: string;
    payTreatment?: string | null; // PAID | UNPAID | SPLIT
    paidDays?: number | null;
    unpaidDays?: number | null;
    managerNote?: string | null;
    isHalfDay?: boolean | null;
    numberOfDays: number;
  }>;
  existingPayrollRecord?: {
    status: string;
    finalPayable?: number;
    presentDays?: number;
    paidLeaveDays?: number;
    unpaidLeaveDays?: number;
    notes?: string | null;
  } | null;
}): EmployeePayrollCalculation {
  const { user, calendarSummary, salaryRecords, attendances, leaveRequests, existingPayrollRecord } = params;

  const totalCalendarDaysInMonth = Math.max(1, calendarSummary.calendarDaysCount);

  // 1. Sort salary records chronologically
  const sortedSalaries = [...salaryRecords].sort(
    (a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime()
  );

  // Helper to find applicable salary record for a specific dateKey (YYYY-MM-DD)
  const getSalaryForDate = (dateKey: string) => {
    if (sortedSalaries.length === 0) return null;
    // Find the latest record whose effectiveFrom <= dateKey
    for (let i = sortedSalaries.length - 1; i >= 0; i--) {
      const rec = sortedSalaries[i];
      const fromKey = getIndiaDateKey(rec.effectiveFrom);
      const toKey = rec.effectiveTo ? getIndiaDateKey(rec.effectiveTo) : '9999-12-31';
      if (dateKey >= fromKey && dateKey <= toKey) {
        return rec;
      }
    }
    // Fallback to earliest record if dateKey is before first effectiveFrom, or latest
    const firstFrom = getIndiaDateKey(sortedSalaries[0].effectiveFrom);
    if (dateKey < firstFrom) {
      return sortedSalaries[0];
    }
    return sortedSalaries[sortedSalaries.length - 1];
  };

  // 2. Resolve joining and exit boundaries
  const joiningKey = user.joiningDate ? getIndiaDateKey(user.joiningDate) : '1970-01-01';
  const exitKey = user.exitDate ? getIndiaDateKey(user.exitDate) : '9999-12-31';

  // Attendance lookup by dateKey
  const attendanceMap = new Map<string, (typeof attendances)[0]>();
  for (const att of attendances) {
    const key = getIndiaDateKey(att.date);
    if (key) attendanceMap.set(key, att);
  }

  let presentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let pendingLeaveDays = 0;
  let rejectedLeaveDays = 0;
  let employeeWorkingDays = 0;
  let totalGrossEarnable = 0;
  let totalUnpaidDeduction = 0;

  const dayByDayBreakdown: EmployeePayrollCalculation['dayByDayBreakdown'] = [];

  for (const day of calendarSummary.days) {
    const dateKey = day.dateKey;
    const isWithinTenure = dateKey >= joiningKey && dateKey <= exitKey;

    if (!isWithinTenure) {
      dayByDayBreakdown.push({
        dateKey,
        dayNumber: day.dayNumber,
        dayName: day.dayName,
        dayStatus: 'OUT_OF_TENURE',
        attendanceStatus: null,
        leaveStatus: null,
        leaveType: null,
        isDeducted: false,
        deductionUnits: 0,
        dayDailyRate: 0,
        dayBaseSalary: 0,
      });
      continue;
    }

    const isRequiredWorkingDay = day.isWorkingDay;
    const salaryRec = getSalaryForDate(dateKey);
    const dayMonthlyBase = salaryRec ? Number(salaryRec.baseSalary) || 0 : 0;
    
    // Policy: Daily Salary Rate = Monthly Salary ÷ Number of calendar days in payroll month
    const dayDailyRate = dayMonthlyBase > 0 ? dayMonthlyBase / totalCalendarDaysInMonth : 0;

    if (isRequiredWorkingDay) {
      employeeWorkingDays++;
    }
    totalGrossEarnable += dayDailyRate;

    const attRecord = attendanceMap.get(dateKey);
    const attStatus = attRecord?.status || null;

    // Check overlapping leaves for this day
    const matchingLeaves = leaveRequests.filter((l) => {
      const start = getIndiaDateKey(l.startDate);
      const end = getIndiaDateKey(l.endDate);
      return dateKey >= start && dateKey <= end;
    });

    let leaveStatus: string | null = null;
    let leaveType: string | null = null;
    let isDeducted = false;
    let deductionUnits = 0;
    let leavePaidUnits = 0;
    let leaveUnpaidUnits = 0;

    if (matchingLeaves.length > 0) {
      const topLeave = matchingLeaves[0];
      leaveType = topLeave.leaveType;

      if (topLeave.currentStage === 'APPROVED') {
        // Consume persisted dayAllocations / monthAllocation from managerNote if available
        let customDayAllocation: { paidUnits?: number; unpaidUnits?: number } | null = null;
        if (topLeave.managerNote) {
          try {
            const parsed = JSON.parse(topLeave.managerNote);
            const dayMap = parsed?.split?.dayAllocations || parsed?.dayAllocations;
            if (dayMap && dayMap[dateKey]) {
              customDayAllocation = dayMap[dateKey];
            }
          } catch {
            // Not JSON, continue to fallback
          }
        }

        if (customDayAllocation) {
          leavePaidUnits = Number(customDayAllocation.paidUnits) || 0;
          leaveUnpaidUnits = Number(customDayAllocation.unpaidUnits) || 0;
          if (leavePaidUnits > 0 && leaveUnpaidUnits > 0) {
            leaveStatus = 'SPLIT';
          } else if (leavePaidUnits > 0) {
            leaveStatus = 'PAID';
          } else {
            leaveStatus = 'UNPAID';
          }
        } else {
          // Fallback based on persisted payTreatment / paidDays / unpaidDays
          const fullUnits = (topLeave as any).isHalfDay ? 0.5 : 1.0;
          if (topLeave.payTreatment === 'PAID') {
            leavePaidUnits = fullUnits;
            leaveUnpaidUnits = 0;
            leaveStatus = 'PAID';
          } else if (topLeave.payTreatment === 'UNPAID') {
            leavePaidUnits = 0;
            leaveUnpaidUnits = fullUnits;
            leaveStatus = 'UNPAID';
          } else if (topLeave.payTreatment === 'SPLIT') {
            const paidTotal = Number(topLeave.paidDays) || 0;
            // Chronological working day distribution within this leave
            const leaveWorkingDays = calendarSummary.days.filter((d) => {
              const dk = d.dateKey;
              const start = getIndiaDateKey(topLeave.startDate);
              const end = getIndiaDateKey(topLeave.endDate);
              return dk >= start && dk <= end && d.isWorkingDay;
            });
            const dayIndex = leaveWorkingDays.findIndex((d) => d.dateKey === dateKey);
            if (dayIndex >= 0) {
              if (dayIndex < Math.floor(paidTotal)) {
                leavePaidUnits = 1.0;
                leaveUnpaidUnits = 0;
                leaveStatus = 'PAID';
              } else if (dayIndex === Math.floor(paidTotal) && paidTotal % 1 !== 0) {
                leavePaidUnits = 0.5;
                leaveUnpaidUnits = 0.5;
                leaveStatus = 'SPLIT';
              } else {
                leavePaidUnits = 0;
                leaveUnpaidUnits = 1.0;
                leaveStatus = 'UNPAID';
              }
            } else {
              leavePaidUnits = 0;
              leaveUnpaidUnits = 0;
              leaveStatus = 'PAID';
            }
          } else {
            leavePaidUnits = fullUnits;
            leaveUnpaidUnits = 0;
            leaveStatus = 'PAID';
          }
        }
      } else if (topLeave.currentStage === 'REJECTED') {
        leaveStatus = 'REJECTED';
      } else {
        leaveStatus = 'PENDING';
      }
    }

    let displayAttStatus: string | null = null;
    if (attRecord) {
      if (attRecord.status === 'ON_LEAVE') {
        displayAttStatus = 'ON_LEAVE';
      } else if (attRecord.checkOutTime || (typeof attRecord.totalHours === 'number' && attRecord.totalHours > 0)) {
        const hours = typeof attRecord.totalHours === 'number' && attRecord.totalHours > 0
          ? attRecord.totalHours
          : (attRecord.checkInTime && attRecord.checkOutTime
              ? (new Date(attRecord.checkOutTime).getTime() - new Date(attRecord.checkInTime).getTime()) / 3600000
              : 0);
        displayAttStatus = classifyAttendanceHours(hours).dbStatus;
      } else {
        displayAttStatus = attRecord.status || (attRecord.checkInTime ? 'PRESENT' : null);
      }
    }

    if (isRequiredWorkingDay) {
      if (matchingLeaves.length > 0 && matchingLeaves[0].currentStage === 'APPROVED') {
        // Authoritative approved leave allocation takes precedence
        paidLeaveDays += leavePaidUnits;
        unpaidLeaveDays += leaveUnpaidUnits;

        // Calculate remaining uncovered working portion of the day (capped at 1.0 day total per date)
        const coveredByLeave = leavePaidUnits + leaveUnpaidUnits;
        const remainingWorkingPortion = Math.max(0, 1.0 - coveredByLeave);

        // Check if attendance exists to cover the remaining working portion
        let effectivePresent = 0;
        if (remainingWorkingPortion > 0 && attRecord) {
          let attUnits = 0;
          if (attRecord.status === 'ON_LEAVE') {
            attUnits = 0;
          } else if (attRecord.checkOutTime || (typeof attRecord.totalHours === 'number' && attRecord.totalHours > 0)) {
            const hours = typeof attRecord.totalHours === 'number' && attRecord.totalHours > 0
              ? attRecord.totalHours
              : (attRecord.checkInTime && attRecord.checkOutTime
                  ? (new Date(attRecord.checkOutTime).getTime() - new Date(attRecord.checkInTime).getTime()) / 3600000
                  : 0);
            const classification = classifyAttendanceHours(hours);
            attUnits = classification.dayUnits;
          } else if (attRecord.checkInTime) {
            // Actively checked in today (shift in progress)
            attUnits = 1.0;
          } else if (attRecord.status === 'HALF_DAY') {
            attUnits = 0.5;
          } else if (attRecord.status === 'PRESENT') {
            attUnits = 1.0;
          }

          effectivePresent = Math.min(remainingWorkingPortion, attUnits);
        }

        presentDays += effectivePresent;

        // Any remaining uncovered portion without attendance is unpaid absence
        const unaccountedUnpaid = Math.max(0, remainingWorkingPortion - effectivePresent);
        unpaidLeaveDays += unaccountedUnpaid;

        const totalDayDeduction = leaveUnpaidUnits + unaccountedUnpaid;
        if (totalDayDeduction > 0) {
          isDeducted = true;
          deductionUnits = totalDayDeduction;
          totalUnpaidDeduction += totalDayDeduction * dayDailyRate;
        }
      } else if (matchingLeaves.length > 0 && matchingLeaves[0].currentStage === 'PENDING') {
        pendingLeaveDays += 1.0;
        unpaidLeaveDays += 1.0;
        isDeducted = true;
        deductionUnits = 1.0;
        totalUnpaidDeduction += 1.0 * dayDailyRate;
      } else if (matchingLeaves.length > 0 && matchingLeaves[0].currentStage === 'REJECTED') {
        rejectedLeaveDays += 1.0;
        unpaidLeaveDays += 1.0;
        isDeducted = true;
        deductionUnits = 1.0;
        totalUnpaidDeduction += 1.0 * dayDailyRate;
      } else {
        // No leave request on this working date: evaluate authoritative attendance classification
        let attUnits = 0;

        if (attRecord) {
          if (attRecord.status === 'ON_LEAVE') {
            attUnits = 0;
          } else if (attRecord.checkOutTime || (typeof attRecord.totalHours === 'number' && attRecord.totalHours > 0)) {
            const hours = typeof attRecord.totalHours === 'number' && attRecord.totalHours > 0
              ? attRecord.totalHours
              : (attRecord.checkInTime && attRecord.checkOutTime
                  ? (new Date(attRecord.checkOutTime).getTime() - new Date(attRecord.checkInTime).getTime()) / 3600000
                  : 0);
            const classification = classifyAttendanceHours(hours);
            attUnits = classification.dayUnits;
          } else if (attRecord.checkInTime) {
            // Actively checked in today (shift in progress)
            attUnits = 1.0;
          } else if (attRecord.status === 'HALF_DAY') {
            attUnits = 0.5;
          } else if (attRecord.status === 'PRESENT') {
            attUnits = 1.0;
          }
        }

        if (attUnits === 1.0) {
          // Full Day (>= 8h worked): 1.0 present, 0 unpaid
          presentDays += 1.0;
          deductionUnits = 0;
          isDeducted = false;
        } else if (attUnits === 0.5) {
          // Half Day (4h - 8h worked): exactly 0.5 present, 0.5 unpaid working day
          presentDays += 0.5;
          unpaidLeaveDays += 0.5;
          deductionUnits = 0.5;
          isDeducted = true;
          totalUnpaidDeduction += 0.5 * dayDailyRate;
        } else {
          // Below Half Day (< 4h worked) or Unexplained Absence:
          // Treated as exactly 1.0 unpaid working day without duplicate absence penalty
          unpaidLeaveDays += 1.0;
          deductionUnits = 1.0;
          isDeducted = true;
          totalUnpaidDeduction += 1.0 * dayDailyRate;
        }
      }
    }

    dayByDayBreakdown.push({
      dateKey,
      dayNumber: day.dayNumber,
      dayName: day.dayName,
      dayStatus: day.status,
      attendanceStatus: displayAttStatus,
      leaveStatus,
      leaveType,
      isDeducted,
      deductionUnits,
      dayDailyRate: Math.round(dayDailyRate * 100) / 100,
      dayBaseSalary: dayMonthlyBase,
    });
  }

  // Ensure strict non-negative bounds
  presentDays = Math.max(0, presentDays);
  paidLeaveDays = Math.max(0, paidLeaveDays);
  unpaidLeaveDays = Math.max(0, Math.min(employeeWorkingDays, unpaidLeaveDays));

  // Determine standard baseSalary to report in summary
  const latestActiveSalary = sortedSalaries[sortedSalaries.length - 1];
  const reportedBaseSalary = latestActiveSalary ? Number(latestActiveSalary.baseSalary) || 0 : 0;
  const employmentType = latestActiveSalary?.employmentType || user.employmentType || 'FULL_TIME';
  const salaryEffectiveFrom = latestActiveSalary?.effectiveFrom || null;

  // Handle salary not configured (baseSalary = 0)
  if (reportedBaseSalary === 0 || sortedSalaries.length === 0) {
    const status = (existingPayrollRecord?.status as any) || 'CALCULATED';
    return {
      userId: user.id,
      fullName: user.fullName,
      employeeId: user.employeeId,
      teamName: user.team?.name || 'Unassigned',
      employmentType,
      baseSalary: 0,
      salaryEffectiveFrom: null,
      salaryRecordsCount: 0,
      calendarDays: calendarSummary.calendarDaysCount,
      weeklyOffs: calendarSummary.weeklyOffsCount,
      companyHolidays: calendarSummary.companyHolidaysCount,
      specialWorkingDays: calendarSummary.specialWorkingDaysCount,
      workingDays: calendarSummary.workingDaysCount,
      employeeWorkingDays,
      presentDays,
      paidLeaveDays,
      unpaidLeaveDays,
      pendingLeaveDays,
      rejectedLeaveDays,
      dailyRate: 0,
      unpaidDeduction: 0,
      finalPayable: 0,
      status,
      notes: existingPayrollRecord?.notes || null,
      dayByDayBreakdown,
    };
  }

  // If employee was active whole month with no salary changes, gross is exactly baseSalary
  const effectiveBaseSalary =
    sortedSalaries.length <= 1 && dayByDayBreakdown.every((d) => d.dayStatus !== 'OUT_OF_TENURE')
      ? reportedBaseSalary
      : Math.round(totalGrossEarnable * 100) / 100;

  // Daily Salary Rate = Monthly Salary ÷ Calendar Days in Payroll Month
  const averageDailyRate =
    totalCalendarDaysInMonth > 0
      ? Math.round((reportedBaseSalary / totalCalendarDaysInMonth) * 100) / 100
      : 0;

  // Salary Components (for manager clarity and breakdown)
  const unroundedDailyRate = totalCalendarDaysInMonth > 0 ? reportedBaseSalary / totalCalendarDaysInMonth : 0;
  const presentAndPaidLeaveSalary =
    reportedBaseSalary > 0
      ? Math.round((presentDays + paidLeaveDays) * unroundedDailyRate * 100) / 100
      : 0;
  const weekOffAndHolidaySalary =
    reportedBaseSalary > 0
      ? Math.round((calendarSummary.weeklyOffsCount + calendarSummary.companyHolidaysCount) * unroundedDailyRate * 100) / 100
      : 0;

  const unpaidDeduction = Math.max(0, Math.round(totalUnpaidDeduction * 100) / 100);
  const finalPayable = Math.max(0, Math.round((effectiveBaseSalary - totalUnpaidDeduction) * 100) / 100);

  let status: 'DRAFT' | 'CALCULATED' | 'FINALIZED' | 'RECALCULATION_REQUIRED' =
    (existingPayrollRecord?.status as any) || 'CALCULATED';

  if (existingPayrollRecord && existingPayrollRecord.status === 'FINALIZED') {
    const isDifferent =
      (existingPayrollRecord.finalPayable !== undefined && Math.abs(finalPayable - existingPayrollRecord.finalPayable) > 0.01) ||
      (existingPayrollRecord.presentDays !== undefined && Math.abs(presentDays - existingPayrollRecord.presentDays) > 0.01) ||
      (existingPayrollRecord.paidLeaveDays !== undefined && Math.abs(paidLeaveDays - existingPayrollRecord.paidLeaveDays) > 0.01) ||
      (existingPayrollRecord.unpaidLeaveDays !== undefined && Math.abs(unpaidLeaveDays - existingPayrollRecord.unpaidLeaveDays) > 0.01);

    if (isDifferent) {
      status = 'RECALCULATION_REQUIRED';
    } else {
      status = 'FINALIZED';
    }
  }

  return {
    userId: user.id,
    fullName: user.fullName,
    employeeId: user.employeeId,
    teamName: user.team?.name || 'Unassigned',
    employmentType,
    baseSalary: reportedBaseSalary,
    salaryEffectiveFrom,
    salaryRecordsCount: sortedSalaries.length,
    calendarDays: calendarSummary.calendarDaysCount,
    weeklyOffs: calendarSummary.weeklyOffsCount,
    companyHolidays: calendarSummary.companyHolidaysCount,
    specialWorkingDays: calendarSummary.specialWorkingDaysCount,
    workingDays: calendarSummary.workingDaysCount,
    employeeWorkingDays,
    presentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    pendingLeaveDays,
    rejectedLeaveDays,
    dailyRate: averageDailyRate,
    presentAndPaidLeaveSalary,
    weekOffAndHolidaySalary,
    unpaidDeduction,
    finalPayable,
    status,
    notes: existingPayrollRecord?.notes || null,
    dayByDayBreakdown,
  };
}
