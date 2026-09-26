import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import EmployeeAttendanceHub from '@/components/attendance/EmployeeAttendanceHub';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';
import { autoFinalizeForgottenAttendance } from '@/lib/autoCheckout';

import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import PushNotificationToggle from '@/components/profile/PushNotificationToggle';

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

  const now = new Date();
  const hour = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  const h = parseInt(hour, 10);
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetingEmoji = h < 12 ? '☀️' : h < 17 ? '🌤️' : '🌙';

  const firstName = session?.fullName?.split(' ')[0] || 'there';
  const teamName = userProfile?.team?.name || 'Core Operations';

  return (
    <div className="space-y-3 ws-animate-fade-up">
      {/* Compact hero greeting */}
      <div className="ws-hero rounded-xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-indigo-200 text-[11px] font-medium tracking-wide">{greetingEmoji} {greeting}</p>
              <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">{session?.fullName}</h1>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-indigo-200/90 bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {teamName}
              </span>
              <span className="text-xs text-indigo-200/80 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 11:00 AM – 8:00 PM
              </span>
            </div>
          </div>
          <Link href="/employee/work-calendar" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-xs transition border border-white/20 shrink-0">
            <Calendar className="w-3.5 h-3.5" /> Calendar
          </Link>
        </div>
      </div>

      {/* Push-In Reminder Setup Card (shown only if not enabled on this device) */}
      <PushNotificationToggle userRole={session?.role ?? 'EMPLOYEE'} variant="dashboard" />

      {/* ─── ATTENDANCE HUB ─── */}
      <EmployeeAttendanceHub
        initialTodayAttendance={todayAttendance}
        allRecords={allRecords}
        currentUserId={session!.id}
      />
    </div>
  );
}