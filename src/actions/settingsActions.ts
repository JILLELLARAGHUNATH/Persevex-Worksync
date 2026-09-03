'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { createSafeAuditLog } from '@/lib/audit';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { invalidateOfficeSettingsCache } from '@/lib/geofence';

export async function updateSystemSettingsAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized: Only Managers can modify office settings.' };
  }

  const companyName = (formData.get('companyName') as string)?.trim() || 'Persevex Systems Corp';
  const companyEmail = (formData.get('companyEmail') as string)?.trim() || 'admin@persevex.com';
  const officeStartTime = (formData.get('officeStartTime') as string)?.trim() || '11:00';
  const officeEndTime = (formData.get('officeEndTime') as string)?.trim() || '20:00';
  const gracePeriodMinutes = parseInt(formData.get('gracePeriodMinutes') as string) || 15;

  const officeLatitude = (formData.get('officeLatitude') as string)?.trim() || '12.916480';
  const officeLongitude = (formData.get('officeLongitude') as string)?.trim() || '77.618145';
  const officeRadiusMeters = (formData.get('officeRadiusMeters') as string)?.trim() || '100';
  const enableLocationCheck = formData.get('enableLocationCheck') === 'true' || formData.get('enableLocationCheck') === 'on';

  if (officeLatitude && (isNaN(Number(officeLatitude)) || Number(officeLatitude) < -90 || Number(officeLatitude) > 90)) {
    return { success: false, error: 'Invalid Latitude. Must be between -90 and 90.' };
  }
  if (officeLongitude && (isNaN(Number(officeLongitude)) || Number(officeLongitude) < -180 || Number(officeLongitude) > 180)) {
    return { success: false, error: 'Invalid Longitude. Must be between -180 and 180.' };
  }
  if (officeRadiusMeters && (isNaN(Number(officeRadiusMeters)) || Number(officeRadiusMeters) < 10 || Number(officeRadiusMeters) > 50000)) {
    return { success: false, error: 'Radius must be between 10m and 50,000m.' };
  }

  const updated = await prisma.systemSetting.upsert({
    where: { id: 'global_config' },
    update: {
      companyName,
      companyEmail,
      officeStartTime,
      officeEndTime,
      gracePeriodMinutes,
      officeLatitude,
      officeLongitude,
      officeRadiusMeters,
      enableLocationCheck,
    },
    create: {
      id: 'global_config',
      companyName,
      companyEmail,
      officeStartTime,
      officeEndTime,
      gracePeriodMinutes,
      officeLatitude,
      officeLongitude,
      officeRadiusMeters,
      enableLocationCheck,
    },
  });

  invalidateOfficeSettingsCache();

  await createSafeAuditLog({
    userId: session.id,
    role: session.role,
    action: 'OFFICE_SETTINGS_UPDATED',
    target: 'SystemSetting#global_config',
    details: `Office Geofence updated by ${session.fullName}`,
  });

  try {
    appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, { action: 'OFFICE_SETTINGS_UPDATED', settings: updated });
  } catch (e) {}

  revalidatePath('/manager/settings');
  revalidatePath('/manager');
  revalidatePath('/employee');
  return { success: true };
}