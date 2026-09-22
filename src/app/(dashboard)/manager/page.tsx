import { prisma } from '@/lib/prisma';
import ManagerDashboardClient from '@/components/attendance/ManagerDashboardClient';
import { autoFinalizeForgottenAttendance } from '@/lib/autoCheckout';

import Link from 'next/link';
import { Calendar, Banknote } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerDashboardPage() {
  await autoFinalizeForgottenAttendance();

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Manager Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time workforce attendance analytics, punctuality distribution, and team metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/manager/work-calendar"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" /> Work Calendar
          </Link>
          <Link
            href="/manager/salary-payroll"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Banknote className="w-3.5 h-3.5" /> Salary & Payroll
          </Link>
        </div>
      </div>

      <ManagerDashboardClient
        initialEmployees={employees}
        initialTeams={teams}
        initialAttendances={attendances}
        initialApprovedLeaves={approvedLeaves}
      />
    </div>
  );
}
