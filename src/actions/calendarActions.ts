'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { buildMonthWorkCalendar, attachLeavesToCalendar, MonthCalendarSummary } from '@/lib/calendar';
import { getIndiaDateKey } from '@/lib/attendanceDate';
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
