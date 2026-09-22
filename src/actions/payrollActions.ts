'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { buildMonthWorkCalendar } from '@/lib/calendar';
import { calculateEmployeePayroll, MonthPayrollSummary } from '@/lib/payroll';
import { createSafeAuditLog } from '@/lib/audit';
import { getIndiaDateKey } from '@/lib/attendanceDate';
import * as XLSX from 'xlsx';

/**
 * Authorization guard: Only MANAGER role has access to any salary or payroll data.
 * Throws an explicit error for any non-manager request.
 */
async function assertManagerSession() {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    throw new Error('ACCESS_DENIED: Salary and payroll data is strictly restricted to Management.');
  }
  return session;
}

/**
 * Retrieves monthly payroll summary and calculated payroll table for all employees.
 * Manager ONLY.
 */
export async function getMonthlyPayrollAction(params: {
  year: number;
  month: number; // 1 - 12
  search?: string;
  teamId?: string;
  status?: string;
}): Promise<{
  success: boolean;
  error?: string;
  summary?: MonthPayrollSummary;
}> {
  try {
    const session = await assertManagerSession();

    const year = Number(params.year) || new Date().getFullYear();
    const month = Number(params.month) || new Date().getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const totalDays = new Date(year, month, 0).getDate();

    // Timezone-accurate IST monthly boundaries:
    // 1st of month 00:00:00 IST -> Date.UTC(year, month - 1, 1, -5, -30, 0, 0)
    // Last day of month 23:59:59.999 IST -> Date.UTC(year, month - 1, totalDays, 18, 29, 59, 999)
    const startIST = new Date(Date.UTC(year, month - 1, 1, -5, -30, 0, 0));
    const endIST = new Date(Date.UTC(year, month - 1, totalDays, 18, 29, 59, 999));
    const startKey = `${monthKey}-01`;
    const endKey = `${monthKey}-${String(totalDays).padStart(2, '0')}`;

    // 1. Fetch Calendar overrides for this month
    const calendarOverrides = await prisma.companyCalendar.findMany({
      where: {
        dateKey: { gte: startKey, lte: endKey },
      },
    });
    const calendarSummary = buildMonthWorkCalendar(year, month, calendarOverrides);

    // 2. Fetch Active Users eligible for payroll (Employees & Team Leads; strictly EXCLUDE Managers)
    const users = await prisma.user.findMany({
      where: {
        isDeleted: false,
        role: { not: 'MANAGER' },
        ...(params.teamId ? { teamId: params.teamId } : {}),
      },
      include: {
        team: true,
        salaryRecords: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    // 3. Fetch all Attendances for this month
    const attendances = await prisma.attendance.findMany({
      where: {
        date: { gte: startIST, lte: endIST },
      },
    });

    // 4. Fetch all Leaves overlapping this month
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        startDate: { lte: endIST },
        endDate: { gte: startIST },
      },
    });

    // 5. Fetch existing PayrollRecords for this month
    const existingPayrollRecords = await prisma.payrollRecord.findMany({
      where: { year, month },
    });
    const payrollRecordMap = new Map<string, (typeof existingPayrollRecords)[0]>();
    for (const rec of existingPayrollRecords) {
      payrollRecordMap.set(rec.userId, rec);
    }

    // Group attendances and leaves by user
    const attendanceByUser = new Map<string, typeof attendances>();
    for (const att of attendances) {
      if (!attendanceByUser.has(att.userId)) attendanceByUser.set(att.userId, []);
      attendanceByUser.get(att.userId)!.push(att);
    }

    const leavesByUser = new Map<string, typeof leaves>();
    for (const l of leaves) {
      if (!leavesByUser.has(l.userId)) leavesByUser.set(l.userId, []);
      leavesByUser.get(l.userId)!.push(l);
    }

    // 6. Calculate for each employee strictly from DB records
    let calculatedEmployees = users.map((user) => {
      const userAttendances = attendanceByUser.get(user.id) || [];
      const userLeaves = leavesByUser.get(user.id) || [];
      const existingRec = payrollRecordMap.get(user.id) || null;
      const salaryRecords = user.salaryRecords || [];

      return calculateEmployeePayroll({
        user,
        calendarSummary,
        salaryRecords,
        attendances: userAttendances,
        leaveRequests: userLeaves,
        existingPayrollRecord: existingRec,
      });
    });

    // Apply Search Filter
    if (params.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      calculatedEmployees = calculatedEmployees.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.teamName.toLowerCase().includes(q)
      );
    }

    // Apply Status Filter
    if (params.status) {
      calculatedEmployees = calculatedEmployees.filter((e) => e.status === params.status);
    }

    // Totals
    const totalEmployees = calculatedEmployees.length;
    let totalMonthlySalary = 0;
    let totalPayableSalary = 0;
    let totalPaidLeaveDays = 0;
    let totalUnpaidDays = 0;

    for (const emp of calculatedEmployees) {
      totalMonthlySalary += emp.baseSalary;
      totalPayableSalary += emp.finalPayable;
      totalPaidLeaveDays += emp.paidLeaveDays;
      totalUnpaidDays += emp.unpaidLeaveDays;
    }

    // Determine overall month lifecycle status
    let monthStatus: MonthPayrollSummary['status'] = 'CALCULATED';
    if (calculatedEmployees.some((e) => e.status === 'RECALCULATION_REQUIRED')) {
      monthStatus = 'RECALCULATION_REQUIRED';
    } else if (existingPayrollRecords.length > 0) {
      const allFinalized = existingPayrollRecords.length === users.length &&
        existingPayrollRecords.every((r: { status: string }) => r.status === 'FINALIZED') &&
        calculatedEmployees.every((e) => e.status === 'FINALIZED');
      const anyRecalc = existingPayrollRecords.some((r: { status: string }) => r.status === 'RECALCULATION_REQUIRED');
      if (anyRecalc) monthStatus = 'RECALCULATION_REQUIRED';
      else if (allFinalized) monthStatus = 'FINALIZED';
    }

    const summary: MonthPayrollSummary = {
      year,
      month,
      monthKey,
      totalEmployees,
      totalMonthlySalary: Math.round(totalMonthlySalary * 100) / 100,
      totalPayableSalary: Math.round(totalPayableSalary * 100) / 100,
      totalPaidLeaveDays,
      totalUnpaidDays,
      applicableWorkingDays: calendarSummary.workingDaysCount,
      calendarDaysCount: calendarSummary.calendarDaysCount,
      status: monthStatus,
      employees: calculatedEmployees,
    };

    return { success: true, summary };
  } catch (err: any) {
    console.error('getMonthlyPayrollAction error:', err);
    return { success: false, error: err.message || 'Failed to calculate payroll.' };
  }
}

/**
 * Retrieves detailed breakdown and day-by-day logs for a specific employee.
 * Manager ONLY.
 */
export async function getEmployeePayrollDetailAction(params: {
  userId: string;
  year: number;
  month: number;
}): Promise<{
  success: boolean;
  error?: string;
  detail?: any;
}> {
  try {
    const session = await assertManagerSession();
    const { userId, year, month } = params;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const totalDays = new Date(year, month, 0).getDate();

    const startIST = new Date(Date.UTC(year, month - 1, 1, -5, -30, 0, 0));
    const endIST = new Date(Date.UTC(year, month - 1, totalDays, 18, 29, 59, 999));
    const startKey = `${monthKey}-01`;
    const endKey = `${monthKey}-${String(totalDays).padStart(2, '0')}`;

    const [user, calendarOverrides, attendances, leaves, existingRecord] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          team: true,
          salaryRecords: { orderBy: { effectiveFrom: 'desc' } },
        },
      }),
      prisma.companyCalendar.findMany({
        where: { dateKey: { gte: startKey, lte: endKey } },
      }),
      prisma.attendance.findMany({
        where: { userId, date: { gte: startIST, lte: endIST } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          userId,
          startDate: { lte: endIST },
          endDate: { gte: startIST },
        },
      }),
      prisma.payrollRecord.findUnique({
        where: {
          userId_year_month: { userId, year, month },
        },
      }),
    ]);

    if (!user || user.isDeleted) return { success: false, error: 'Employee not found.' };
    if (user.role === 'MANAGER') {
      return { success: false, error: 'Manager accounts are not eligible for employee payroll calculations.' };
    }

    const calendarSummary = buildMonthWorkCalendar(year, month, calendarOverrides);
    const salaryRecords = user.salaryRecords || [];

    const calc = calculateEmployeePayroll({
      user,
      calendarSummary,
      salaryRecords,
      attendances,
      leaveRequests: leaves,
      existingPayrollRecord: existingRecord,
    });

    return {
      success: true,
      detail: {
        ...calc,
        allSalaryRecords: salaryRecords,
        leaves,
        attendances,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch employee payroll details' };
  }
}

/**
 * Creates or updates an employee's master payroll details (base salary, effective date, employment type, joining/exit dates).
 * Manager ONLY.
 */
export async function saveEmployeeSalaryAction(data: {
  userId: string;
  baseSalary: number;
  employmentType?: string;
  effectiveFrom: string; // "YYYY-MM-DD"
  joiningDate?: string; // "YYYY-MM-DD"
  exitDate?: string | null; // "YYYY-MM-DD" or null
  notes?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const session = await assertManagerSession();

    const baseSalary = Number(data.baseSalary);
    if (isNaN(baseSalary) || baseSalary < 0) {
      return { success: false, error: 'Base salary must be a valid non-negative amount.' };
    }

    const targetUser = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!targetUser || targetUser.isDeleted) {
      return { success: false, error: 'Employee not found.' };
    }
    if (targetUser.role === 'MANAGER') {
      return { success: false, error: 'Manager accounts are not eligible for employee payroll salary records.' };
    }

    const effectiveFrom = new Date(data.effectiveFrom + 'T00:00:00.000Z');
    const employmentType = data.employmentType || 'FULL_TIME';

    // Check if an existing SalaryRecord for this user starts on the exact same date
    const existingSameDateRecord = await prisma.salaryRecord.findFirst({
      where: {
        userId: data.userId,
        effectiveFrom: {
          gte: new Date(data.effectiveFrom + 'T00:00:00.000Z'),
          lt: new Date(data.effectiveFrom + 'T23:59:59.999Z'),
        },
      },
    });

    if (existingSameDateRecord) {
      await prisma.salaryRecord.update({
        where: { id: existingSameDateRecord.id },
        data: {
          baseSalary,
          employmentType,
          notes: data.notes || null,
        },
      });
    } else {
      // 1. Close prior active salary record
      await prisma.salaryRecord.updateMany({
        where: {
          userId: data.userId,
          effectiveTo: null,
          effectiveFrom: { lt: effectiveFrom },
        },
        data: {
          effectiveTo: new Date(effectiveFrom.getTime() - 1),
        },
      });

      // 2. Insert new SalaryRecord
      await prisma.salaryRecord.create({
        data: {
          userId: data.userId,
          baseSalary,
          employmentType,
          effectiveFrom,
          effectiveTo: null,
          notes: data.notes || null,
          createdById: session.id,
        },
      });
    }

    // 3. Update User master details (employmentType, joiningDate, exitDate)
    const userUpdateData: any = { employmentType };
    if (data.joiningDate) {
      userUpdateData.joiningDate = new Date(data.joiningDate + 'T00:00:00.000Z');
    }
    if (data.exitDate !== undefined) {
      userUpdateData.exitDate = data.exitDate ? new Date(data.exitDate + 'T00:00:00.000Z') : null;
    }

    await prisma.user.update({
      where: { id: data.userId },
      data: userUpdateData,
    });

    // 4. Mark finalized payroll from effectiveFrom onwards as RECALCULATION_REQUIRED
    const effectiveYear = effectiveFrom.getUTCFullYear();
    const effectiveMonth = effectiveFrom.getUTCMonth() + 1;

    await prisma.payrollRecord.updateMany({
      where: {
        userId: data.userId,
        OR: [
          { year: { gt: effectiveYear } },
          { year: effectiveYear, month: { gte: effectiveMonth } },
        ],
        status: 'FINALIZED',
      },
      data: {
        status: 'RECALCULATION_REQUIRED',
      },
    });

    await createSafeAuditLog({
      userId: session.id,
      role: session.role,
      action: 'SALARY_UPDATED',
      target: `User#${data.userId}`,
      details: `Set base salary to ₹${baseSalary} (${employmentType}) effective from ${data.effectiveFrom}`,
    });

    appEvents.emit(EVENT_TYPES.PAYROLL_UPDATE, {
      action: 'SALARY_UPDATED',
      userId: data.userId,
      baseSalary,
    });

    revalidatePath('/manager/salary-payroll');

    return { success: true, message: `Payroll master details updated for employee (₹${baseSalary.toLocaleString('en-IN')})` };
  } catch (err: any) {
    console.error('saveEmployeeSalaryAction error:', err);
    return { success: false, error: err.message || 'Failed to save salary record.' };
  }
}

/**
 * Saves and finalizes payroll calculation for all or single employee in a month.
 * Manager ONLY.
 */
export async function finalizeMonthlyPayrollAction(params: {
  year: number;
  month: number;
  userId?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const session = await assertManagerSession();
    const { year, month } = params;

    const res = await getMonthlyPayrollAction({ year, month });
    if (!res.success || !res.summary) {
      return { success: false, error: res.error || 'Failed to compute monthly payroll.' };
    }

    const employeesToFinalize = params.userId
      ? res.summary.employees.filter((e) => e.userId === params.userId)
      : res.summary.employees;

    for (const emp of employeesToFinalize) {
      await prisma.payrollRecord.upsert({
        where: {
          userId_year_month: {
            userId: emp.userId,
            year,
            month,
          },
        },
        update: {
          monthKey: res.summary.monthKey,
          baseSalary: emp.baseSalary,
          employmentType: emp.employmentType,
          calendarDays: emp.calendarDays,
          weeklyOffs: emp.weeklyOffs,
          companyHolidays: emp.companyHolidays,
          workingDays: emp.workingDays,
          presentDays: emp.presentDays,
          paidLeaveDays: emp.paidLeaveDays,
          unpaidLeaveDays: emp.unpaidLeaveDays,
          dailyRate: emp.dailyRate,
          unpaidDeduction: emp.unpaidDeduction,
          finalPayable: emp.finalPayable,
          status: 'FINALIZED',
          finalizedAt: new Date(),
          finalizedById: session.id,
        },
        create: {
          userId: emp.userId,
          year,
          month,
          monthKey: res.summary.monthKey,
          baseSalary: emp.baseSalary,
          employmentType: emp.employmentType,
          calendarDays: emp.calendarDays,
          weeklyOffs: emp.weeklyOffs,
          companyHolidays: emp.companyHolidays,
          workingDays: emp.workingDays,
          presentDays: emp.presentDays,
          paidLeaveDays: emp.paidLeaveDays,
          unpaidLeaveDays: emp.unpaidLeaveDays,
          dailyRate: emp.dailyRate,
          unpaidDeduction: emp.unpaidDeduction,
          finalPayable: emp.finalPayable,
          status: 'FINALIZED',
          finalizedAt: new Date(),
          finalizedById: session.id,
        },
      });
    }

    await createSafeAuditLog({
      userId: session.id,
      role: session.role,
      action: 'PAYROLL_FINALIZED',
      target: `Payroll#${year}-${month}`,
      details: `Finalized payroll for ${res.summary.monthKey} (${employeesToFinalize.length} employees, Total ₹${res.summary.totalPayableSalary})`,
    });

    appEvents.emit(EVENT_TYPES.PAYROLL_UPDATE, {
      action: 'PAYROLL_FINALIZED',
      year,
      month,
    });

    revalidatePath('/manager/salary-payroll');

    return {
      success: true,
      message: `Payroll for ${res.summary.monthKey} successfully finalized!`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to finalize payroll' };
  }
}

/**
 * Re-runs calculation and updates payroll records status to CALCULATED.
 * Manager ONLY.
 */
export async function recalculateMonthlyPayrollAction(params: {
  year: number;
  month: number;
  userId?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const session = await assertManagerSession();
    const { year, month } = params;

    const res = await getMonthlyPayrollAction({ year, month });
    if (!res.success || !res.summary) {
      return { success: false, error: res.error || 'Failed to compute monthly payroll.' };
    }

    const employees = params.userId
      ? res.summary.employees.filter((e) => e.userId === params.userId)
      : res.summary.employees;

    for (const emp of employees) {
      await prisma.payrollRecord.upsert({
        where: {
          userId_year_month: {
            userId: emp.userId,
            year,
            month,
          },
        },
        update: {
          monthKey: res.summary.monthKey,
          baseSalary: emp.baseSalary,
          employmentType: emp.employmentType,
          calendarDays: emp.calendarDays,
          weeklyOffs: emp.weeklyOffs,
          companyHolidays: emp.companyHolidays,
          workingDays: emp.workingDays,
          presentDays: emp.presentDays,
          paidLeaveDays: emp.paidLeaveDays,
          unpaidLeaveDays: emp.unpaidLeaveDays,
          dailyRate: emp.dailyRate,
          unpaidDeduction: emp.unpaidDeduction,
          finalPayable: emp.finalPayable,
          status: 'CALCULATED',
        },
        create: {
          userId: emp.userId,
          year,
          month,
          monthKey: res.summary.monthKey,
          baseSalary: emp.baseSalary,
          employmentType: emp.employmentType,
          calendarDays: emp.calendarDays,
          weeklyOffs: emp.weeklyOffs,
          companyHolidays: emp.companyHolidays,
          workingDays: emp.workingDays,
          presentDays: emp.presentDays,
          paidLeaveDays: emp.paidLeaveDays,
          unpaidLeaveDays: emp.unpaidLeaveDays,
          dailyRate: emp.dailyRate,
          unpaidDeduction: emp.unpaidDeduction,
          finalPayable: emp.finalPayable,
          status: 'CALCULATED',
        },
      });
    }

    appEvents.emit(EVENT_TYPES.PAYROLL_UPDATE, {
      action: 'PAYROLL_RECALCULATED',
      year,
      month,
    });

    revalidatePath('/manager/salary-payroll');

    return {
      success: true,
      message: `Payroll for ${res.summary.monthKey} recalculated successfully!`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to recalculate payroll' };
  }
}

/**
 * Generates and downloads authoritative payroll report in CSV or XLSX format.
 * Manager ONLY.
 */
export async function exportMonthlyPayrollReportAction(params: {
  year: number;
  month: number;
  format?: 'xlsx' | 'csv';
}): Promise<{ success: boolean; base64?: string; fileName?: string; error?: string }> {
  try {
    const session = await assertManagerSession();
    const { year, month, format = 'csv' } = params;

    const res = await getMonthlyPayrollAction({ year, month });
    if (!res.success || !res.summary) {
      return { success: false, error: res.error || 'Failed to compute monthly payroll for export.' };
    }

    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = MONTH_NAMES[month - 1] || `Month_${month}`;

    const data = res.summary.employees.map((emp) => {
      const hasSalary = emp.baseSalary > 0;
      const unroundedDailyRate = emp.baseSalary / (emp.calendarDays || 30);
      const presentAndPaidSal = hasSalary
        ? (emp.presentAndPaidLeaveSalary ?? Math.round((emp.presentDays + emp.paidLeaveDays) * unroundedDailyRate * 100) / 100)
        : 0;
      const weekOffAndHolidaySal = hasSalary
        ? (emp.weekOffAndHolidaySalary ?? Math.round((emp.weeklyOffs + emp.companyHolidays) * unroundedDailyRate * 100) / 100)
        : 0;

      return {
        'Employee Name': emp.fullName,
        'Employee ID': emp.employeeId,
        'Team': emp.teamName,
        'Employment Type': emp.employmentType === 'INTERN' ? 'Intern' : 'Full-Time',
        'Base Salary': hasSalary ? emp.baseSalary : 'Salary Not Set',
        'Present Days': emp.presentDays,
        'Paid Leave Days': emp.paidLeaveDays,
        'Unpaid Days': emp.unpaidLeaveDays,
        'Present + Paid Leave Salary': hasSalary ? presentAndPaidSal : 0,
        'Week Off + Holiday Salary': hasSalary ? weekOffAndHolidaySal : 0,
        'Unpaid Deduction': hasSalary ? emp.unpaidDeduction : 0,
        'Total Payable': hasSalary ? emp.finalPayable : 'Salary Not Set',
        'Payroll Status': emp.status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Payroll ${monthName} ${year}`);
    const bookType = format === 'csv' ? 'csv' : 'xlsx';
    const base64 = XLSX.write(workbook, { type: 'base64', bookType });
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const fileName = `Persevex_Payroll_${monthName}_${year}.${ext}`;

    await createSafeAuditLog({
      userId: session.id,
      role: session.role,
      action: 'PAYROLL_EXPORTED',
      target: `Payroll#${year}-${String(month).padStart(2, '0')}`,
      details: `Exported ${res.summary.monthKey} payroll report as ${ext.toUpperCase()} (${data.length} records)`,
    });

    return { success: true, base64, fileName };
  } catch (err: any) {
    console.error('exportMonthlyPayrollReportAction error:', err);
    return { success: false, error: err.message || 'Failed to export payroll report.' };
  }
}

/**
 * Authorizes individual employee payslip generation and logs audit trail.
 * Manager ONLY.
 */
export async function downloadEmployeePayslipAction(params: {
  userId: string;
  year: number;
  month: number;
}): Promise<{
  success: boolean;
  error?: string;
  detail?: any;
  fileName?: string;
}> {
  try {
    const session = await assertManagerSession();
    const { userId, year, month } = params;

    const res = await getEmployeePayrollDetailAction({ userId, year, month });
    if (!res.success || !res.detail) {
      return { success: false, error: res.error || 'Failed to load employee payroll details.' };
    }

    if (!res.detail.baseSalary || res.detail.baseSalary <= 0) {
      return {
        success: false,
        error: 'Salary is not configured for this employee. Please set a base salary before generating a payslip.',
      };
    }

    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = MONTH_NAMES[month - 1] || `Month_${month}`;
    const safeName = (res.detail.fullName || 'Employee').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Persevex_Payslip_${safeName}_${monthName}_${year}.pdf`;

    await createSafeAuditLog({
      userId: session.id,
      role: session.role,
      action: 'PAYSLIP_DOWNLOADED',
      target: `User#${userId}`,
      details: `Generated payslip for ${res.detail.fullName} (${monthName} ${year})`,
    });

    return {
      success: true,
      detail: res.detail,
      fileName,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to authorize payslip download.' };
  }
}

