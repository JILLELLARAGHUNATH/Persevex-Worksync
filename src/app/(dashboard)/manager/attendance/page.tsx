import { prisma } from '@/lib/prisma';
import UnifiedAttendanceTable from '@/components/attendance/UnifiedAttendanceTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerAttendancePage() {
  const [records, teams, employees, approvedLeaves] = await Promise.all([
    prisma.attendance.findMany({
      include: { user: { include: { team: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.team.findMany({ where: { isActive: true } }),
    prisma.user.findMany({
      where: { isDeleted: false },
      include: { team: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.leaveRequest.findMany({
      where: { currentStage: 'APPROVED' },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Organization Attendance Ledger</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Real-time check-in and check-out logs, shift punctuality, and working hours
        </p>
      </div>

      <UnifiedAttendanceTable
        initialRecords={records}
        teams={teams}
        employees={employees}
        approvedLeaves={approvedLeaves}
        showTeamCol={true}
      />
    </div>
  );
}
