'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { buildMonthWorkCalendar, attachLeavesToCalendar, MonthCalendarSummary } from '@/lib/calendar';
import { getIndiaDateKey, getTodayIndiaDateKey, getIndiaWorkdayInfo } from '@/lib/attendanceDate';
import { createSafeAuditLog } from '@/lib/audit';

/**
 * Retrieves the month calendar with holidays, special working days, and user leave records.
 * STRICT SECURITY: Non-manager users (Employee / Team Lead) ONLY receive their OWN leaves.
 */
export async function getWorkCalendarMonthAction(params: {
  year: number;
  month: number; // 1 - 12
  userId?: string;
}): Promise<{
  success: boolean;
  error?: string;
  calendar?: MonthCalendarSummary;
  canEdit?: boolean;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const year = Number(params.year) || new Date().getFullYear();
  const month = Number(params.month) || new Date().getMonth() + 1;
  const isManager = session.role === 'MANAGER';

  // Strict IDOR protection: Non-managers can NEVER query another employee's leaves
  const targetUserId = isManager ? params.userId : session.id;

  try {
    const totalDays = new Date(year, month, 0).getDate();
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const startKey = `${monthKey}-01`;
    const endKey = `${monthKey}-${String(totalDays).padStart(2, '0')}`;

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, totalDays, 23, 59, 59, 999));

    // 1. Fetch Company Calendar overrides (Holidays & Special Working Days)
    const calendarOverrides = await prisma.companyCalendar.findMany({
      where: {
        dateKey: {
          gte: startKey,
          lte: endKey,
        },
      },
      orderBy: { dateKey: 'asc' },
    });

    // 2. Build base calendar structure
    const calendarSummary = buildMonthWorkCalendar(year, month, calendarOverrides);

    // 3. Fetch leaves strictly filtered by role permissions
    const leaveWhere: any = {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    };

    if (targetUserId) {
      leaveWhere.userId = targetUserId;
    } else if (!isManager) {
      leaveWhere.userId = session.id;
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: leaveWhere,
      include: {
        user: {
          select: {
            fullName: true,
            employeeId: true,
            role: true,
            team: { select: { name: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // 4. Attach leaves to calendar days
    calendarSummary.days = attachLeavesToCalendar(calendarSummary.days, leaves as any);

    // 5. Enrich with Attendance data (Role-specific with Strict IDOR Protection)
    const todayKey = getTodayIndiaDateKey();
    const startIST = new Date(Date.UTC(year, month - 1, 1, -5, -30, 0, 0));
    const endIST = new Date(Date.UTC(year, month - 1, totalDays, 18, 29, 59, 999));

    if (!isManager) {
      // Non-Manager: strictly fetch OWN attendance records (Zero IDOR exposure)
      const personalAttendances = await prisma.attendance.findMany({
        where: {
          userId: session.id,
          date: { gte: startIST, lte: endIST },
        },
        orderBy: { date: 'asc' },
      });

      const attMap = new Map<string, typeof personalAttendances[0]>();
      for (const a of personalAttendances) {
        const k = getIndiaDateKey(a.date);
        if (k) attMap.set(k, a);
      }

      let presentDaysCount = 0;
      let absentDaysCount = 0;
      let halfDaysCount = 0;

      for (const day of calendarSummary.days) {
        const att = attMap.get(day.dateKey);
        if (att) {
          const isCurrentlyPunchedIn = Boolean(att.checkInTime && !att.checkOutTime);
          let classification = 'Present';
          if (isCurrentlyPunchedIn) {
            classification = 'Punched In';
          } else if (att.status === 'HALF_DAY') {
            classification = 'Half Day';
          } else if (att.status === 'ABSENT') {
            classification = 'Absent';
          }

          day.attendance = {
            id: att.id,
            status: att.status as any,
            checkInTime: att.checkInTime ? att.checkInTime.toISOString() : null,
            checkOutTime: att.checkOutTime ? att.checkOutTime.toISOString() : null,
            totalHours: att.totalHours,
            isPunchedIn: isCurrentlyPunchedIn,
            classification,
          };

          if (isCurrentlyPunchedIn || att.status === 'PRESENT') {
            presentDaysCount++;
          } else if (att.status === 'HALF_DAY') {
            halfDaysCount++;
          } else if (att.status === 'ABSENT') {
            absentDaysCount++;
          }
        } else {
          // If no record: for today, show neutral Pending / Not Punched In
          if (day.dateKey === todayKey) {
            day.attendance = {
              status: 'PENDING',
              checkInTime: null,
              checkOutTime: null,
              totalHours: 0,
              isPunchedIn: false,
              classification: 'Not Punched In',
            };
          } else {
            day.attendance = null;
          }
        }
      }

      calendarSummary.presentDaysCount = presentDaysCount;
      calendarSummary.absentDaysCount = absentDaysCount;
      calendarSummary.halfDaysCount = halfDaysCount;
    } else {
      // Manager: Calculate aggregated attendance counts for each date
      const eligibleUsers = await prisma.user.findMany({
        where: {
          isDeleted: false,
          accountStatus: 'ACTIVE',
          role: { in: ['EMPLOYEE', 'TEAM_LEAD'] },
        },
        select: {
          id: true,
          joiningDate: true,
          exitDate: true,
        },
      });

      const allMonthAttendances = await prisma.attendance.findMany({
        where: {
          date: { gte: startIST, lte: endIST },
          user: {
            isDeleted: false,
            role: { in: ['EMPLOYEE', 'TEAM_LEAD'] },
          },
        },
        select: {
          id: true,
          userId: true,
          date: true,
          checkInTime: true,
          checkOutTime: true,
          status: true,
        },
      });

      const allMonthApprovedLeaves = await prisma.leaveRequest.findMany({
        where: {
          currentStage: 'APPROVED',
          startDate: { lte: endIST },
          endDate: { gte: startIST },
          user: {
            isDeleted: false,
            role: { in: ['EMPLOYEE', 'TEAM_LEAD'] },
          },
        },
        select: {
          id: true,
          userId: true,
          startDate: true,
          endDate: true,
          numberOfDays: true,
        },
      });

      // Group attendances by dateKey -> userId -> record
      const attsByDate = new Map<string, Map<string, typeof allMonthAttendances[0]>>();
      for (const a of allMonthAttendances) {
        const k = getIndiaDateKey(a.date);
        if (k) {
          if (!attsByDate.has(k)) attsByDate.set(k, new Map());
          attsByDate.get(k)!.set(a.userId, a);
        }
      }

      for (const day of calendarSummary.days) {
        if (day.dateKey > todayKey) {
          day.attendanceSummary = null;
          continue;
        }

        const isWorkDay = day.isSpecialWorkingDay || (day.isWorkingDay && !day.isCompanyHoliday && !day.isWeeklyOff);
        const dayAttMap = attsByDate.get(day.dateKey);

        // Filter eligible users active on this specific date
        const dayEligibleUsers = eligibleUsers.filter((u) => {
          if (u.joiningDate && getIndiaDateKey(u.joiningDate) > day.dateKey) return false;
          if (u.exitDate && getIndiaDateKey(u.exitDate) < day.dateKey) return false;
          return true;
        });

        let presentCount = 0;
        let absentCount = 0;
        let halfDayCount = 0;
        let pendingCount = 0;

        if (!isWorkDay) {
          // Company Holiday or Weekly Off (without Special Working Day override)
          // Absences are 0. Any voluntary punch-ins count as present.
          if (dayAttMap) {
            for (const att of dayAttMap.values()) {
              if (att.status === 'HALF_DAY') {
                halfDayCount++;
              } else if (att.status === 'PRESENT' || att.checkInTime) {
                presentCount++;
              }
            }
          }
        } else {
          // Standard Working Day or Special Working Day
          for (const u of dayEligibleUsers) {
            const att = dayAttMap?.get(u.id);
            if (att) {
              if (att.status === 'HALF_DAY') {
                halfDayCount++;
              } else if (att.status === 'ABSENT') {
                absentCount++;
              } else {
                presentCount++;
              }
            } else {
              // No attendance record: check approved full-day leave
              const hasFullDayLeave = allMonthApprovedLeaves.some((l) => {
                if (l.userId !== u.id || l.numberOfDays < 1) return false;
                const sKey = getIndiaDateKey(l.startDate);
                const eKey = getIndiaDateKey(l.endDate);
                return day.dateKey >= sKey && day.dateKey <= eKey;
              });

              if (hasFullDayLeave) {
                // On approved leave, not absent
              } else if (day.dateKey === todayKey) {
                // Today: not yet punched in -> Pending, not absent
                pendingCount++;
              } else {
                // Past working day with no attendance and no leave -> Absent
                absentCount++;
              }
            }
          }
        }

        day.attendanceSummary = {
          presentCount,
          absentCount,
          halfDayCount,
          pendingCount,
        };
      }
    }

    return {
      success: true,
      calendar: calendarSummary,
      canEdit: isManager,
    };
  } catch (err: any) {
    console.error('getWorkCalendarMonthAction error:', err);
    return { success: false, error: err.message || 'Failed to load work calendar' };
  }
}

export interface DateAttendanceEmployee {
  id: string;
  fullName: string;
  employeeId: string;
  role: string;
  teamName?: string;
  status: string; // 'PRESENT' | 'PUNCHED_IN' | 'HALF_DAY' | 'ABSENT' | 'PENDING' | 'ON_LEAVE'
  checkInTime?: string | null;
  checkOutTime?: string | null;
  totalHours?: number;
}

/**
 * Retrieves detailed employee breakdown for a specific date. Manager ONLY.
 * Used for hover / tap popovers on Present and Absent counts.
 */
export async function getManagerDateAttendanceDetailsAction(params: {
  dateKey: string;
}): Promise<{
  success: boolean;
  error?: string;
  dateKey: string;
  isWorkDay: boolean;
  isCompanyHoliday: boolean;
  isWeeklyOff: boolean;
  holidayTitle?: string;
  presentEmployees: DateAttendanceEmployee[];
  absentEmployees: DateAttendanceEmployee[];
  halfDayEmployees: DateAttendanceEmployee[];
  pendingEmployees: DateAttendanceEmployee[];
  onLeaveEmployees: DateAttendanceEmployee[];
}> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return {
      success: false,
      error: 'Unauthorized: Only Managers can view workforce attendance details.',
      dateKey: params.dateKey,
      isWorkDay: false,
      isCompanyHoliday: false,
      isWeeklyOff: false,
      presentEmployees: [],
      absentEmployees: [],
      halfDayEmployees: [],
      pendingEmployees: [],
      onLeaveEmployees: [],
    };
  }

  const { dateKey } = params;
  const todayKey = getTodayIndiaDateKey();

  if (!dateKey || dateKey > todayKey) {
    return {
      success: true,
      dateKey,
      isWorkDay: false,
      isCompanyHoliday: false,
      isWeeklyOff: false,
      presentEmployees: [],
      absentEmployees: [],
      halfDayEmployees: [],
      pendingEmployees: [],
      onLeaveEmployees: [],
    };
  }

  try {
    const override = await prisma.companyCalendar.findUnique({ where: { dateKey } });
    const dayDate = new Date(dateKey + 'T00:00:00.000Z');
    const dayOfWeek = dayDate.getUTCDay();
    const isCompanyHoliday = override?.type === 'COMPANY_HOLIDAY';
    const isSpecialWorkingDay = override?.type === 'SPECIAL_WORKING_DAY';
    const isWeeklyOff = dayOfWeek === 3 && !isSpecialWorkingDay && !isCompanyHoliday;
    const isWorkDay = isSpecialWorkingDay || (!isCompanyHoliday && !isWeeklyOff);

    // Fetch active eligible workforce
    const eligibleUsers = await prisma.user.findMany({
      where: {
        isDeleted: false,
        accountStatus: 'ACTIVE',
        role: { in: ['EMPLOYEE', 'TEAM_LEAD'] },
      },
      select: {
        id: true,
        fullName: true,
        employeeId: true,
        role: true,
        joiningDate: true,
        exitDate: true,
        team: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const dayUsers = eligibleUsers.filter((u) => {
      if (u.joiningDate && getIndiaDateKey(u.joiningDate) > dateKey) return false;
      if (u.exitDate && getIndiaDateKey(u.exitDate) < dateKey) return false;
      return true;
    });

    // Date bounds in IST
    const [y, m, d] = dateKey.split('-').map(Number);
    const startOfDayIST = new Date(Date.UTC(y, m - 1, d, -5, -30, 0, 0));
    const endOfDayIST = new Date(Date.UTC(y, m - 1, d, 18, 29, 59, 999));

    const attendances = await prisma.attendance.findMany({
      where: {
        date: { gte: startOfDayIST, lte: endOfDayIST },
        user: { isDeleted: false, role: { in: ['EMPLOYEE', 'TEAM_LEAD'] } },
      },
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        currentStage: 'APPROVED',
        startDate: { lte: endOfDayIST },
        endDate: { gte: startOfDayIST },
        user: { isDeleted: false, role: { in: ['EMPLOYEE', 'TEAM_LEAD'] } },
      },
    });

    const attMap = new Map<string, (typeof attendances)[0]>();
    for (const a of attendances) {
      attMap.set(a.userId, a);
    }

    const leaveMap = new Map<string, (typeof leaves)[0]>();
    for (const l of leaves) {
      leaveMap.set(l.userId, l);
    }

    const formatTime = (date: Date | null | undefined) => {
      if (!date) return null;
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    };

    const presentEmployees: DateAttendanceEmployee[] = [];
    const absentEmployees: DateAttendanceEmployee[] = [];
    const halfDayEmployees: DateAttendanceEmployee[] = [];
    const pendingEmployees: DateAttendanceEmployee[] = [];
    const onLeaveEmployees: DateAttendanceEmployee[] = [];

    for (const user of dayUsers) {
      const att = attMap.get(user.id);
      const leave = leaveMap.get(user.id);

      if (att) {
        const isCurrentlyPunchedIn = Boolean(att.checkInTime && !att.checkOutTime);
        if (att.status === 'HALF_DAY') {
          halfDayEmployees.push({
            id: user.id,
            fullName: user.fullName,
            employeeId: user.employeeId,
            role: user.role,
            teamName: user.team?.name,
            status: 'HALF_DAY',
            checkInTime: formatTime(att.checkInTime),
            checkOutTime: formatTime(att.checkOutTime),
            totalHours: att.totalHours,
          });
        } else if (att.status === 'ABSENT') {
          absentEmployees.push({
            id: user.id,
            fullName: user.fullName,
            employeeId: user.employeeId,
            role: user.role,
            teamName: user.team?.name,
            status: 'ABSENT',
          });
        } else {
          presentEmployees.push({
            id: user.id,
            fullName: user.fullName,
            employeeId: user.employeeId,
            role: user.role,
            teamName: user.team?.name,
            status: isCurrentlyPunchedIn ? 'PUNCHED_IN' : 'PRESENT',
            checkInTime: formatTime(att.checkInTime),
            checkOutTime: formatTime(att.checkOutTime),
            totalHours: att.totalHours,
          });
        }
      } else {
        // No attendance record
        if (leave && leave.numberOfDays >= 1) {
          onLeaveEmployees.push({
            id: user.id,
            fullName: user.fullName,
            employeeId: user.employeeId,
            role: user.role,
            teamName: user.team?.name,
            status: 'ON_LEAVE',
          });
        } else if (!isWorkDay) {
          // Holiday or Weekly off, no absence
        } else if (dateKey === todayKey) {
          pendingEmployees.push({
            id: user.id,
            fullName: user.fullName,
            employeeId: user.employeeId,
            role: user.role,
            teamName: user.team?.name,
            status: 'PENDING',
          });
        } else {
          absentEmployees.push({
            id: user.id,
            fullName: user.fullName,
            employeeId: user.employeeId,
            role: user.role,
            teamName: user.team?.name,
            status: 'ABSENT',
          });
        }
      }
    }

    return {
      success: true,
      dateKey,
      isWorkDay,
      isCompanyHoliday,
      isWeeklyOff,
      holidayTitle: override?.title,
      presentEmployees,
      absentEmployees,
      halfDayEmployees,
      pendingEmployees,
      onLeaveEmployees,
    };
  } catch (err: any) {
    console.error('getManagerDateAttendanceDetailsAction error:', err);
    return {
      success: false,
      error: err.message || 'Failed to load date attendance details',
      dateKey,
      isWorkDay: false,
      isCompanyHoliday: false,
      isWeeklyOff: false,
      presentEmployees: [],
      absentEmployees: [],
      halfDayEmployees: [],
      pendingEmployees: [],
      onLeaveEmployees: [],
    };
  }
}

/**
 * Adds a Company Holiday (single day or date range). Manager ONLY.
 */
export async function addCompanyHolidayAction(data: {
  date: string; // "YYYY-MM-DD"
  endDate?: string; // "YYYY-MM-DD" optional
  title: string;
  description?: string;
  notifyUsers?: boolean;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized: Only Managers can add company holidays.' };
  }

  const title = data.title?.trim();
  if (!title) return { success: false, error: 'Holiday title is required.' };
  if (!data.date) return { success: false, error: 'Start date is required.' };

  const startKey = data.date;
  const endKey = data.endDate && data.endDate >= data.date ? data.endDate : data.date;

  try {
    const startDate = new Date(startKey + 'T00:00:00.000Z');
    const endDate = new Date(endKey + 'T00:00:00.000Z');

    const createdKeys: string[] = [];
    const curr = new Date(startDate);

    while (curr <= endDate) {
      const dateKey = curr.toISOString().split('T')[0];
      const canonicalDate = new Date(curr.getTime());

      await prisma.companyCalendar.upsert({
        where: { dateKey },
        update: {
          type: 'COMPANY_HOLIDAY',
          title,
          description: data.description || null,
          createdById: session.id,
        },
        create: {
          date: canonicalDate,
          dateKey,
          type: 'COMPANY_HOLIDAY',
          title,
          description: data.description || null,
          createdById: session.id,
        },
      });

      createdKeys.push(dateKey);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    // Mark any finalized payroll in affected months as RECALCULATION_REQUIRED
    const affectedMonthKeys = Array.from(new Set(createdKeys.map((k) => k.substring(0, 7))));
    await prisma.payrollRecord.updateMany({
      where: {
        monthKey: { in: affectedMonthKeys },
        status: 'FINALIZED',
      },
      data: {
        status: 'RECALCULATION_REQUIRED',
      },
    });

    // Notify employees if requested
    if (data.notifyUsers) {
      const usersToNotify = await prisma.user.findMany({
        where: { isDeleted: false, accountStatus: 'ACTIVE', id: { not: session.id } },
        select: { id: true },
      });

      if (usersToNotify.length > 0) {
        const holidayDesc = startKey === endKey ? startKey : `${startKey} to ${endKey}`;
        await prisma.notification.createMany({
          data: usersToNotify.map((u) => ({
            userId: u.id,
            title: `Company Holiday: ${title}`,
            message: `Management declared a company holiday (${holidayDesc}): ${title}.`,
            type: 'SYSTEM',
            link: '/employee/work-calendar',
            isRead: false,
          })),
        });
      }
    }

    await createSafeAuditLog({
      userId: session.id,
      role: session.role,
      action: 'CALENDAR_HOLIDAY_ADDED',
      target: `Holiday#${title}`,
      details: `Declared holiday: ${title} on ${startKey} to ${endKey}`,
    });

    appEvents.emit(EVENT_TYPES.CALENDAR_UPDATE, {
      action: 'HOLIDAY_ADDED',
      title,
      startKey,
      endKey,
      createdKeys,
    });
    appEvents.emit(EVENT_TYPES.NOTIFICATION_RECEIVED, { action: 'HOLIDAY_ADDED' });

    revalidatePath('/manager/work-calendar');
    revalidatePath('/team-lead/work-calendar');
    revalidatePath('/employee/work-calendar');
    revalidatePath('/manager/salary-payroll');

    return { success: true, message: `Company holiday "${title}" added successfully!` };
  } catch (err: any) {
    console.error('addCompanyHolidayAction error:', err);
    return { success: false, error: err.message || 'Failed to add company holiday' };
  }
}

/**
 * Updates a Company Holiday entry. Manager ONLY.
 */
export async function updateCompanyHolidayAction(data: {
  id: string;
  title: string;
  description?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const updated = await prisma.companyCalendar.update({
      where: { id: data.id },
      data: {
        title: data.title.trim(),
        description: data.description || null,
      },
    });

    appEvents.emit(EVENT_TYPES.CALENDAR_UPDATE, {
      action: 'HOLIDAY_UPDATED',
      id: updated.id,
      entry: updated,
    });

    revalidatePath('/manager/work-calendar');
    revalidatePath('/team-lead/work-calendar');
    revalidatePath('/employee/work-calendar');

    return { success: true, message: 'Holiday updated successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update holiday' };
  }
}

/**
 * Deletes a Company Holiday or Special Working Day entry. Manager ONLY.
 */
export async function deleteCalendarEntryAction(
  id: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const target = await prisma.companyCalendar.findUnique({ where: { id } });
    if (!target) return { success: false, error: 'Calendar entry not found' };

    await prisma.companyCalendar.delete({ where: { id } });

    // Mark finalized payroll in that month as RECALCULATION_REQUIRED
    const monthKey = target.dateKey.substring(0, 7);
    await prisma.payrollRecord.updateMany({
      where: {
        monthKey,
        status: 'FINALIZED',
      },
      data: {
        status: 'RECALCULATION_REQUIRED',
      },
    });

    await createSafeAuditLog({
      userId: session.id,
      role: session.role,
      action: 'CALENDAR_ENTRY_DELETED',
      target: `Calendar#${id}`,
      details: `Deleted ${target.type}: ${target.title} on ${target.dateKey}`,
    });

    appEvents.emit(EVENT_TYPES.CALENDAR_UPDATE, {
      action: 'ENTRY_DELETED',
      id,
      dateKey: target.dateKey,
    });

    revalidatePath('/manager/work-calendar');
    revalidatePath('/team-lead/work-calendar');
    revalidatePath('/employee/work-calendar');
    revalidatePath('/manager/salary-payroll');

    return { success: true, message: 'Calendar entry removed successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete calendar entry' };
  }
}

/**
 * Adds a Special Working Day override (e.g. Wednesday Working Day). Manager ONLY.
 */
export async function addSpecialWorkingDayAction(data: {
  date: string; // "YYYY-MM-DD"
  title: string;
  description?: string;
  notifyUsers?: boolean;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized: Only Managers can declare special working days.' };
  }

  const title = data.title?.trim() || 'Special Working Day';
  if (!data.date) return { success: false, error: 'Date is required.' };

  const dateKey = data.date;

  try {
    const canonicalDate = new Date(dateKey + 'T00:00:00.000Z');

    const entry = await prisma.companyCalendar.upsert({
      where: { dateKey },
      update: {
        type: 'SPECIAL_WORKING_DAY',
        title,
        description: data.description || null,
        createdById: session.id,
      },
      create: {
        date: canonicalDate,
        dateKey,
        type: 'SPECIAL_WORKING_DAY',
        title,
        description: data.description || null,
        createdById: session.id,
      },
    });

    // Mark finalized payroll in that month as RECALCULATION_REQUIRED
    const monthKey = dateKey.substring(0, 7);
    await prisma.payrollRecord.updateMany({
      where: {
        monthKey,
        status: 'FINALIZED',
      },
      data: {
        status: 'RECALCULATION_REQUIRED',
      },
    });

    if (data.notifyUsers) {
      const usersToNotify = await prisma.user.findMany({
        where: { isDeleted: false, accountStatus: 'ACTIVE', id: { not: session.id } },
        select: { id: true },
      });

      if (usersToNotify.length > 0) {
        await prisma.notification.createMany({
          data: usersToNotify.map((u) => ({
            userId: u.id,
            title: `Special Working Day: ${dateKey}`,
            message: `Management scheduled a Special Working Day on ${dateKey} (${title}).`,
            type: 'SYSTEM',
            link: '/employee/work-calendar',
            isRead: false,
          })),
        });
      }
    }

    await createSafeAuditLog({
      userId: session.id,
      role: session.role,
      action: 'SPECIAL_WORKING_DAY_ADDED',
      target: `SpecialDay#${dateKey}`,
      details: `Declared Special Working Day on ${dateKey}: ${title}`,
    });

    appEvents.emit(EVENT_TYPES.CALENDAR_UPDATE, {
      action: 'SPECIAL_WORKING_DAY_ADDED',
      entry,
      dateKey,
    });
    appEvents.emit(EVENT_TYPES.NOTIFICATION_RECEIVED, { action: 'SPECIAL_WORKING_DAY_ADDED' });

    revalidatePath('/manager/work-calendar');
    revalidatePath('/team-lead/work-calendar');
    revalidatePath('/employee/work-calendar');
    revalidatePath('/manager/salary-payroll');

    return { success: true, message: `Special working day set for ${dateKey}!` };
  } catch (err: any) {
    console.error('addSpecialWorkingDayAction error:', err);
    return { success: false, error: err.message || 'Failed to add special working day' };
  }
}
