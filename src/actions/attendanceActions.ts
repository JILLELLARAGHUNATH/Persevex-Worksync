'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';
import { assertWithinOfficeGeofence } from '@/lib/geofence';

export async function checkInAction(
  coords?: { lat: number; lng: number } | null
): Promise<{ success: boolean; error?: string; data?: any }> {
  const session = await getSession();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized: Please log in.',
    };
  }

  // Get current date and time in India (Asia/Kolkata)
  const now = new Date();
  const india = getIndiaWorkdayInfo(now);

  // Check if an attendance record already exists for today's Indian workday
  const existing = await prisma.attendance.findFirst({
    where: {
      userId: session.id,
      OR: [
        { date: india.canonicalDate },
        { date: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
        { checkInTime: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
      ],
    },
    include: {
      user: {
        include: { team: true },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (existing && existing.checkInTime) {
    return {
      success: false,
      error: 'You have already checked in for today.',
      data: existing,
    };
  }

  // Retrieve office configuration
  const settings = await prisma.systemSetting.findUnique({
    where: {
      id: 'global_config',
    },
  });

  // Geofence validation
  const geofenceResult = assertWithinOfficeGeofence(settings, coords);
  if (!geofenceResult.ok) {
    return {
      success: false,
      error: geofenceResult.error,
    };
  }

  // Calculate late status based on office start time and grace period
  const officeStart = settings?.officeStartTime || '11:00';
  const grace = settings?.gracePeriodMinutes || 15;
  const [startH, startM] = officeStart.split(':').map(Number);

  const currentMinutes = india.hour * 60 + india.minute;
  const cutoffMinutes = (isNaN(startH) ? 11 : startH) * 60 + (isNaN(startM) ? 0 : startM) + (isNaN(grace) ? 15 : grace);

  const lateStatus = currentMinutes > cutoffMinutes ? 'LATE' : 'ON_TIME';

  let attendanceRecord: any;

  if (existing) {
    // Update existing placeholder record (e.g. from roster/leave)
    attendanceRecord = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkInTime: now,
        status: 'PRESENT',
        lateStatus,
      },
      include: {
        user: {
          include: { team: true },
        },
      },
    });
  } else {
    // Create new attendance record for today
    try {
      attendanceRecord = await prisma.attendance.create({
        data: {
          userId: session.id,
          date: india.canonicalDate,
          checkInTime: now,
          status: 'PRESENT',
          lateStatus,
        },
        include: {
          user: {
            include: { team: true },
          },
        },
      });
    } catch {
      // Handle unique constraint race condition fallback
      attendanceRecord = await prisma.attendance.upsert({
        where: {
          userId_date: {
            userId: session.id,
            date: india.canonicalDate,
          },
        },
        update: {
          checkInTime: now,
          status: 'PRESENT',
          lateStatus,
        },
        create: {
          userId: session.id,
          date: india.canonicalDate,
          checkInTime: now,
          status: 'PRESENT',
          lateStatus,
        },
        include: {
          user: {
            include: { team: true },
          },
        },
      });
    }
  }

  appEvents.emit(EVENT_TYPES.ATTENDANCE_UPDATE, {
    status: 'CHECKED_IN',
    attendance: attendanceRecord,
    userId: session.id,
    teamLeadId: session.teamId,
  });

  revalidatePath('/employee');
  revalidatePath('/employee/my-attendance');
  revalidatePath('/team-lead');
  revalidatePath('/team-lead/my-attendance');
  revalidatePath('/manager');
  revalidatePath('/manager/attendance');

  return {
    success: true,
    data: attendanceRecord,
  };
}

export async function checkOutAction(): Promise<{ success: boolean; error?: string; data?: any }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized: Please log in.' };

  const now = new Date();
  const india = getIndiaWorkdayInfo(now);

  // Locate the existing attendance record for today's Indian workday
  const record = await prisma.attendance.findFirst({
    where: {
      userId: session.id,
      OR: [
        { date: india.canonicalDate },
        { date: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
        { checkInTime: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
      ],
    },
    include: {
      user: {
        include: { team: true },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!record || !record.checkInTime) {
    return { success: false, error: 'Cannot clock out without prior clock-in today.' };
  }

  if (record.checkOutTime) {
    return { success: false, error: 'You have already completed clock-out for today.', data: record };
  }

  const diffMs = now.getTime() - new Date(record.checkInTime).getTime();
  const totalHours = parseFloat((Math.max(0, diffMs) / (1000 * 60 * 60)).toFixed(2));

  const updated = await prisma.attendance.update({
    where: { id: record.id },
    data: {
      checkOutTime: now,
      totalHours,
    },
    include: {
      user: {
        include: { team: true },
      },
    },
  });

  appEvents.emit(EVENT_TYPES.ATTENDANCE_UPDATE, {
    status: 'CHECKED_OUT',
    attendance: updated,
    userId: session.id,
    teamLeadId: session.teamId,
  });

  revalidatePath('/employee');
  revalidatePath('/employee/my-attendance');
  revalidatePath('/team-lead');
  revalidatePath('/team-lead/my-attendance');
  revalidatePath('/manager');
  revalidatePath('/manager/attendance');

  return { success: true, data: updated };
}