import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function asFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET() {
  const settings = await prisma.systemSetting.findUnique({ where: { id: 'global_config' } });
  return NextResponse.json({ success: true, data: settings || null });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const {
      companyName,
      companyEmail,
      officeLatitude,
      officeLongitude,
      officeRadiusMeters,
      officeStartTime,
      officeEndTime,
      gracePeriodMinutes,
      enableLocationCheck,
    } = body || {};

    const latitude = asFiniteNumber(officeLatitude);
    const longitude = asFiniteNumber(officeLongitude);
    const radius = asFiniteNumber(officeRadiusMeters);

    if (officeLatitude !== undefined && (latitude === null || latitude < -90 || latitude > 90)) {
      return NextResponse.json({ success: false, error: 'Office latitude must be between -90 and 90.' }, { status: 400 });
    }
    if (officeLongitude !== undefined && (longitude === null || longitude < -180 || longitude > 180)) {
      return NextResponse.json({ success: false, error: 'Office longitude must be between -180 and 180.' }, { status: 400 });
    }
    if (officeRadiusMeters !== undefined && (radius === null || radius < 10 || radius > 50000)) {
      return NextResponse.json({ success: false, error: 'Office geofence radius must be between 10m and 50,000m.' }, { status: 400 });
    }

    const upsertData: Record<string, unknown> = {};
    if (companyName) upsertData.companyName = companyName;
    if (companyEmail) upsertData.companyEmail = companyEmail;
    if (officeLatitude !== undefined) upsertData.officeLatitude = String(officeLatitude);
    if (officeLongitude !== undefined) upsertData.officeLongitude = String(officeLongitude);
    if (officeRadiusMeters !== undefined) upsertData.officeRadiusMeters = String(officeRadiusMeters);
    if (officeStartTime) upsertData.officeStartTime = officeStartTime;
    if (officeEndTime) upsertData.officeEndTime = officeEndTime;
    if (gracePeriodMinutes !== undefined) upsertData.gracePeriodMinutes = Number(gracePeriodMinutes);
    if (enableLocationCheck !== undefined) upsertData.enableLocationCheck = Boolean(enableLocationCheck);

    const saved = await prisma.systemSetting.upsert({
      where: { id: 'global_config' },
      update: upsertData,
      create: { id: 'global_config', ...upsertData },
    });

    revalidatePath('/manager/settings');
    revalidatePath('/manager');
    revalidatePath('/employee');

    try {
      appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, { action: 'OFFICE_SETTINGS_UPDATED', settings: saved });
    } catch (e) {}

    return NextResponse.json({ success: true, data: saved });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
