import { prisma } from '@/lib/prisma';
import UnifiedAttendanceTable from '@/components/attendance/UnifiedAttendanceTable';
import { autoFinalizeForgottenAttendance } from '@/lib/autoCheckout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerAttendancePage() {
  await autoFinalizeForgottenAttendance();

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
    <div className="space-y-3">
      {/* Compact page header */}
      <div className="flex items-center justify-between px-4 py-3 ws-card rounded-xl border-l-4 border-l-emerald-500">
        <div>
          <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Organization Attendance Ledger</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Live check-in / check-out logs, punctuality indicators, and working hours</p>
        </div>
        <span className="text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 shrink-0">
          {records.length} Records
        </span>
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
