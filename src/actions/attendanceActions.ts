'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';
import { assertWithinOfficeGeofence } from '@/lib/geofence';

export async function checkInAction(
  coords?: { lat: number; lng: number; accuracy?: number } | null
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
  console.info('[attendance-geofence]', {
    operation: 'CHECK_IN',
    userId: session.id,
    enforced: Boolean(settings?.enableLocationCheck),
    allowed: geofenceResult.ok,
    distanceMeters: geofenceResult.distance,
    radiusMeters: settings?.officeRadiusMeters ?? null,
    accuracyMeters: coords?.accuracy ?? null,
  });
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
    // Atomic update: only update if checkInTime is still null (prevents concurrent double-click race condition)
    const updateResult = await prisma.attendance.updateMany({
      where: {
        id: existing.id,
        checkInTime: null,
      },
      data: {
        checkInTime: now,
        status: 'PRESENT',
        lateStatus,
      },
    });

    if (updateResult.count === 0) {
      // Concurrently checked in by another request
      const latest = await prisma.attendance.findUnique({
        where: { id: existing.id },
        include: { user: { include: { team: true } } },
      });
      return {
        success: false,
        error: 'You have already checked in for today.',
        data: latest,
      };
    }

    attendanceRecord = await prisma.attendance.findUnique({
      where: { id: existing.id },
      include: { user: { include: { team: true } } },
    });
  } else {
    // Create new attendance record for today with unique constraint protection
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
      // Handle unique constraint race condition: fetch existing record without overwriting checkInTime
      const raceExisting = await prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId: session.id,
            date: india.canonicalDate,
          },
        },
        include: {
          user: {
            include: { team: true },
          },
        },
      });

      if (raceExisting && raceExisting.checkInTime) {
        return {
          success: false,
          error: 'You have already checked in for today.',
          data: raceExisting,
        };
      }

      if (raceExisting) {
        await prisma.attendance.updateMany({
          where: {
            id: raceExisting.id,
            checkInTime: null,
          },
          data: {
            checkInTime: now,
            status: 'PRESENT',
            lateStatus,
          },
        });

        attendanceRecord = await prisma.attendance.findUnique({
          where: { id: raceExisting.id },
          include: { user: { include: { team: true } } },
        });
      }
    }
  }

  if (!attendanceRecord) {
    return {
      success: false,
      error: 'Unable to complete check-in. Please try again.',
    };
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

export async function checkOutAction(
  coords?: { lat: number; lng: number; accuracy?: number } | null
): Promise<{ success: boolean; error?: string; data?: any }> {
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

  // Read the same live configuration used by check-in before any attendance mutation.
  const settings = await prisma.systemSetting.findUnique({ where: { id: 'global_config' } });
  const geofenceResult = assertWithinOfficeGeofence(settings, coords);
  console.info('[attendance-geofence]', {
    operation: 'CHECK_OUT',
    userId: session.id,
    enforced: Boolean(settings?.enableLocationCheck),
    allowed: geofenceResult.ok,
    distanceMeters: geofenceResult.distance,
    radiusMeters: settings?.officeRadiusMeters ?? null,
    accuracyMeters: coords?.accuracy ?? null,
  });
  if (!geofenceResult.ok) {
    return { success: false, error: geofenceResult.error };
  }

  const diffMs = now.getTime() - new Date(record.checkInTime).getTime();
  const totalHours = parseFloat((Math.max(0, diffMs) / (1000 * 60 * 60)).toFixed(2));

  // Atomic conditional update: ensure checkOutTime is only updated if it is currently null
  const updateResult = await prisma.attendance.updateMany({
    where: {
      id: record.id,
      checkInTime: { not: null },
      checkOutTime: null,
    },
    data: {
      checkOutTime: now,
      totalHours,
    },
  });

  if (updateResult.count === 0) {
    // Already checked out concurrently by another request
    const latest = await prisma.attendance.findUnique({
      where: { id: record.id },
      include: { user: { include: { team: true } } },
    });
    return {
      success: false,
      error: 'You have already completed clock-out for today.',
      data: latest,
    };
  }

  const updated = await prisma.attendance.findUnique({
    where: { id: record.id },
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
