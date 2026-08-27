import { prisma } from '@/lib/prisma';
import ManagerDashboardClient from '@/components/attendance/ManagerDashboardClient';

export default async function ManagerDashboardPage() {
  const employees = await prisma.user.findMany({
    where: { isDeleted: false },
    include: { team: true },
  });

  const teams = await prisma.team.findMany({
    where: { isActive: true },
    include: { teamLead: true },
  });

  const attendances = await prisma.attendance.findMany({
    include: { user: { include: { team: true } } },
    orderBy: { date: 'desc' },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Manager Dashboard</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Real-time workforce attendance analytics, punctuality distribution, and team metrics
        </p>
      </div>

      <ManagerDashboardClient
        initialEmployees={employees}
        initialTeams={teams}
        initialAttendances={attendances}
      />
    </div>
  );
}
