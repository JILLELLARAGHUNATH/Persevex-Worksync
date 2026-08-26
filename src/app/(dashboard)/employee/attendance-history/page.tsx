import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import AttendanceTableClient from '@/components/attendance/AttendanceTableClient';

export default async function AttendanceHistoryPage() {
  const session = await getSession();
  const records = await prisma.attendance.findMany({
    where: { userId: session!.id },
    orderBy: { date: 'desc' },
  });

  return (
    <AttendanceTableClient
      initialRecords={records}
      showEmployeeCol={false}
      showDeptCol={false}
      title="Attendance Archive & Monthly Summary"
      subtitle="Historical monthly punch records, working hours analysis, and punctuality logs"
    />
  );
}
