import { prisma } from '../src/lib/prisma';
import { getIndiaWorkdayInfo } from '../src/lib/attendanceDate';
import { haversineMeters } from '../src/lib/geofence';

async function checkRecentAttendances() {
  const india = getIndiaWorkdayInfo();
  const settings = await prisma.systemSetting.findUnique({ where: { id: 'global_config' } });

  console.log('Office Settings in DB:', {
    lat: settings?.officeLatitude,
    lng: settings?.officeLongitude,
    radius: settings?.officeRadiusMeters,
    enableLocationCheck: settings?.enableLocationCheck,
    updatedAt: settings?.updatedAt,
  });

  const todayRecords = await prisma.attendance.findMany({
    where: {
      OR: [
        { date: india.canonicalDate },
        { checkInTime: { gte: india.startOfDayIST } },
      ],
    },
    include: {
      user: { select: { fullName: true, role: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(`\nFound ${todayRecords.length} attendance records created today:`);
  for (const r of todayRecords) {
    console.log(`- [${r.user.role}] ${r.user.fullName} (${r.user.email}): In=${r.checkInTime}, Status=${r.status}, CreatedAt=${r.createdAt}`);
  }

  await prisma.$disconnect();
}

checkRecentAttendances();
