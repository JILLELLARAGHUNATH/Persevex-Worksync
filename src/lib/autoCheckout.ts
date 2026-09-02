import { prisma } from './prisma';
import { getIndiaWorkdayInfo } from './attendanceDate';

/**
 * Automatically finalizes open attendance records where an employee checked in but forgot to check out.
 * 
 * Rules:
 * 1. For past workday records: Auto-checkout is set to 11:00 PM IST (23:00:00) on that workday's date.
 * 2. For today's workday record: If current time in Asia/Kolkata >= 23:00, auto-checkout is set to 11:00 PM IST today.
 * 3. Total working hours are calculated precisely between checkInTime and 11:00 PM IST.
 * 4. Atomic updates ensure zero duplicates and zero race conditions.
 */
export async function autoFinalizeForgottenAttendance(targetUserId?: string): Promise<number> {
  try {
    const now = new Date();
    const india = getIndiaWorkdayInfo(now);

    const isTodayPast11PM = india.hour >= 23;

    // Find all unclosed attendance records
    const whereClause: any = {
      checkInTime: { not: null },
      checkOutTime: null,
    };

    if (targetUserId) {
      whereClause.userId = targetUserId;
    }

    if (!isTodayPast11PM) {
      // Only process past days (before today's 00:00 IST)
      whereClause.date = { lt: india.startOfDayIST };
    }

    const openRecords = await prisma.attendance.findMany({
      where: whereClause,
      take: 200,
    });

    if (openRecords.length === 0) return 0;

    let finalizedCount = 0;

    for (const record of openRecords) {
      if (!record.checkInTime) continue;

      const recordIndia = getIndiaWorkdayInfo(record.date);

      // Construct 23:00:00 IST on the record's workday date
      // In UTC: 23:00 IST - 5:30 = 17:30 UTC
      const autoCheckOutTime = new Date(
        Date.UTC(recordIndia.year, recordIndia.month - 1, recordIndia.day, 17, 30, 0, 0)
      );

      const checkInTime = new Date(record.checkInTime);
      const diffMs = Math.max(0, autoCheckOutTime.getTime() - checkInTime.getTime());
      const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      const updated = await prisma.attendance.updateMany({
        where: {
          id: record.id,
          checkOutTime: null,
        },
        data: {
          checkOutTime: autoCheckOutTime,
          totalHours,
        },
      });

      if (updated.count > 0) {
        finalizedCount++;
      }
    }

    return finalizedCount;
  } catch (error) {
    console.error('Auto-checkout finalization error:', error);
    return 0;
  }
}
