import { prisma } from '@/lib/prisma';
import ManagerDashboardClient from '@/components/attendance/ManagerDashboardClient';
import { autoFinalizeForgottenAttendance } from '@/lib/autoCheckout';
import { getSession } from '@/lib/auth';

import Link from 'next/link';
import { Calendar, Banknote, Users, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerDashboardPage() {
  await autoFinalizeForgottenAttendance();

  const session = await getSession();

  const [employees, teams, attendances, approvedLeaves] = await Promise.all([
    prisma.user.findMany({
      where: { isDeleted: false },
      include: { team: true },
    }),
    prisma.team.findMany({
      where: { isActive: true },
      include: { teamLead: true },
    }),
    prisma.attendance.findMany({
      include: { user: { include: { team: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.leaveRequest.findMany({
      where: { currentStage: 'APPROVED' },
      include: { user: { include: { team: true } } },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  const now = new Date();
  const hour = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  const h = parseInt(hour, 10);
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetingEmoji = h < 12 ? '☀️' : h < 17 ? '🌤️' : '🌙';

  const activeEmployees = employees.filter(
    (e) => !e.isDeleted && e.accountStatus !== 'SUSPENDED' && e.role !== 'MANAGER'
  );
  const totalEmployees = activeEmployees.length;
  const activeTeams = teams.length;

  const firstName = session?.fullName?.split(' ')[0] || 'Manager';

  return (
    <div className="space-y-3">
      {/* ─── COMPACT HERO GREETING ─── */}
      <div className="ws-hero rounded-xl px-4 py-3 sm:px-6 sm:py-4 ws-animate-fade-up">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-indigo-200 text-[11px] font-medium tracking-wide">{greetingEmoji} {greeting}</p>
              <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">{firstName}</h1>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1">
                <Users className="w-3 h-3 text-white/70" />
                <span className="text-white text-xs font-semibold">{totalEmployees} Employees</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1">
                <TrendingUp className="w-3 h-3 text-white/70" />
                <span className="text-white text-xs font-semibold">{activeTeams} Teams</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/manager/work-calendar" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-xs transition border border-white/20">
              <Calendar className="w-3.5 h-3.5" /> Calendar
            </Link>
            <Link href="/manager/salary-payroll" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs transition shadow-md">
              <Banknote className="w-3.5 h-3.5" /> Payroll
            </Link>
          </div>
        </div>
      </div>

      {/* ─── DASHBOARD CLIENT (KPI cards, charts, tables) ─── */}
      <ManagerDashboardClient
        initialEmployees={employees}
        initialTeams={teams}
        initialAttendances={attendances}
        initialApprovedLeaves={approvedLeaves}
      />
    </div>
  );
}
