import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import EmployeeAttendanceHub from '@/components/attendance/EmployeeAttendanceHub';

export default async function EmployeeDashboardPage() {
  const session = await getSession();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayAttendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId: session!.id, date: today } },
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
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
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
      />
    </div>
  );
}