import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const upsertData: any = {};
    if (companyName) upsertData.companyName = companyName;
    if (companyEmail) upsertData.companyEmail = companyEmail;
    if (officeLatitude) upsertData.officeLatitude = String(officeLatitude);
    if (officeLongitude) upsertData.officeLongitude = String(officeLongitude);
    if (officeRadiusMeters) upsertData.officeRadiusMeters = String(officeRadiusMeters);
    if (officeStartTime) upsertData.officeStartTime = officeStartTime;
    if (officeEndTime) upsertData.officeEndTime = officeEndTime;
    if (gracePeriodMinutes !== undefined) upsertData.gracePeriodMinutes = Number(gracePeriodMinutes);
    upsertData.enableLocationCheck = Boolean(enableLocationCheck);

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