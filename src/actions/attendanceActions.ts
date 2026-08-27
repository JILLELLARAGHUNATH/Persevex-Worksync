'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';

function getIndiaDateParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

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

  // Current date and time in India
  const india = getIndiaDateParts();

  // Store the attendance date consistently as IST midnight converted to UTC
  const today = new Date(
    Date.UTC(india.year, india.month - 1, india.day - 1, 18, 30, 0, 0)
  );

  const existing = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId: session.id,
        date: today,
      },
    },
  });

  if (existing && existing.checkInTime) {
    return {
      success: false,
      error: 'You have already checked in for today.',
    };
  }

  // Get office settings
  const settings = await prisma.systemSetting.findUnique({
    where: {
      id: 'global_config',
    },
  });

  const officeStart = settings?.officeStartTime || '11:00';
  const grace = settings?.gracePeriodMinutes || 15;

  const [startH, startM] = officeStart.split(':').map(Number);

  // Calculate cutoff in India time
  const currentMinutes = india.hour * 60 + india.minute;

  const cutoffMinutes =
    startH * 60 +
    startM +
    grace;

  const lateStatus =
    currentMinutes > cutoffMinutes
      ? 'LATE'
      : 'ON_TIME';

  // Actual timestamp
  const now = new Date();

  // Geofence validation
  const officeConfig = settings as any;

  const enableLocation =
    process.env.ENABLE_LOCATION_CHECK === 'true' ||
    Boolean(officeConfig?.enableLocationCheck);

  if (
    enableLocation &&
    officeConfig?.officeLatitude &&
    officeConfig?.officeLongitude
  ) {
    const officeLat = Number(officeConfig.officeLatitude);
    const officeLng = Number(officeConfig.officeLongitude);
    const officeRadius = Number(
      officeConfig.officeRadiusMeters || 100
    );

    if (
      coords &&
      typeof coords.lat === 'number' &&
      typeof coords.lng === 'number'
    ) {
      const toRad = (v: number) => (v * Math.PI) / 180;

      const R = 6371000;

      const dLat = toRad(coords.lat - officeLat);
      const dLon = toRad(coords.lng - officeLng);

      const a =
        Math.sin(dLat / 2) *
          Math.sin(dLat / 2) +
        Math.cos(toRad(officeLat)) *
          Math.cos(toRad(coords.lat)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c =
        2 *
        Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        );

      const distance = R * c;

      if (distance > officeRadius) {
        return {
          success: false,
          error: `You are ${Math.round(
            distance
          )}m away from office (allowed: ${officeRadius}m).`,
        };
      }
    }
  }

  const attendance = await prisma.attendance.upsert({
    where: {
      userId_date: {
        userId: session.id,
        date: today,
      },
    },

    update: {
      checkInTime: now,
      status: 'PRESENT',
      lateStatus,
    },

    create: {
      userId: session.id,
      date: today,
      checkInTime: now,
      status: 'PRESENT',
      lateStatus,
    },
  });

  const attendanceWithUser =
    await prisma.attendance.findUnique({
      where: {
        id: attendance.id,
      },
      include: {
        user: true,
      },
    });

  appEvents.emit(EVENT_TYPES.ATTENDANCE_UPDATE, {
    status: 'CHECKED_IN',
    attendance: attendanceWithUser,
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
    data: attendanceWithUser,
  };
}

export async function checkOutAction(): Promise<{ success: boolean; error?: string; data?: any }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized: Please log in.' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const record = await prisma.attendance.findUnique({
    where: { userId_date: { userId: session.id, date: today } },
  });

  if (!record || !record.checkInTime) {
    return { success: false, error: 'Cannot clock out without prior clock-in today.' };
  }

  if (record.checkOutTime) {
    return { success: false, error: 'You have already completed clock-out for today.' };
  }

  const now = new Date();
  const diffMs = now.getTime() - new Date(record.checkInTime).getTime();
  const totalHours = parseFloat((Math.max(0, diffMs) / (1000 * 60 * 60)).toFixed(2));

  const updated = await prisma.attendance.update({
    where: { id: record.id },
    data: {
      checkOutTime: now,
      totalHours,
    },
    include: { user: true },
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