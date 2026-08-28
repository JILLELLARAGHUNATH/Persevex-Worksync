import { prisma } from '@/lib/prisma';
import ManagerDashboardClient from '@/components/attendance/ManagerDashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerDashboardPage() {
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
        initialApprovedLeaves={approvedLeaves}
      />
    </div>
  );
}
