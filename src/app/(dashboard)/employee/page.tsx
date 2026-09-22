import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import EmployeeAttendanceHub from '@/components/attendance/EmployeeAttendanceHub';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';
import { autoFinalizeForgottenAttendance } from '@/lib/autoCheckout';

import Link from 'next/link';
import { Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmployeeDashboardPage() {
  const session = await getSession();
  if (session?.id) {
    await autoFinalizeForgottenAttendance(session.id);
  }
  const india = getIndiaWorkdayInfo();

  const [todayAttendance, allRecords, userProfile] = await Promise.all([
    prisma.attendance.findFirst({
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
    }),
    prisma.attendance.findMany({
      where: { userId: session!.id },
      orderBy: { date: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: session!.id },
      include: { team: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Welcome back, {session?.fullName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {userProfile?.team?.name || 'Core Operations'} &middot; Shift: 11:00 AM – 8:00 PM (15m Grace)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/employee/work-calendar"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" /> Work Calendar
          </Link>
        </div>
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