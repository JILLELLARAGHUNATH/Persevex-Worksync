import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import EmployeeAttendanceHub from '@/components/attendance/EmployeeAttendanceHub';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';

export default async function EmployeeDashboardPage() {
  const session = await getSession();
  const india = getIndiaWorkdayInfo();

  const todayAttendance = await prisma.attendance.findFirst({
    where: {
      userId: session!.id,
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

  const allRecords = await prisma.attendance.findMany({
    where: { userId: session!.id },
    orderBy: { date: 'desc' },
  });

  const userProfile = await prisma.user.findUnique({
    where: { id: session!.id },
    include: { team: true },
  });

  return (
    <div className="space-y-4">
      {/* Clean Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Welcome back, {session?.fullName}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {userProfile?.team?.name || 'Core Operations'} &middot; Shift: 11:00 AM – 8:00 PM (15m Grace)
        </p>
      </div>

      {/* Main Attendance Hub */}
      <EmployeeAttendanceHub
        initialTodayAttendance={todayAttendance}
        allRecords={allRecords}
        currentUserId={session!.id}
      />
    </div>
  );
}