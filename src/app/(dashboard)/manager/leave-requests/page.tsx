import { prisma } from '@/lib/prisma';
import LeaveRequestsClient from '@/components/leaves/LeaveRequestsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerLeaveRequestsPage() {
  const [leaves, teams, employees] = await Promise.all([
    prisma.leaveRequest.findMany({
      include: { user: { include: { team: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.team.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { isDeleted: false, accountStatus: { not: 'SUSPENDED' }, role: { not: 'MANAGER' } },
      select: { id: true, fullName: true, employeeId: true, teamId: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Leave Requests & Approvals</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Review and execute final decisions on workforce leave applications
        </p>
      </div>

      <LeaveRequestsClient
        initialLeaves={leaves}
        initialTeams={teams}
        initialEmployees={employees}
        role="MANAGER"
      />
    </div>
  );
}

