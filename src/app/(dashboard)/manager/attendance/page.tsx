import { prisma } from '@/lib/prisma';
import UnifiedAttendanceTable from '@/components/attendance/UnifiedAttendanceTable';

export default async function ManagerAttendancePage() {
  const records = await prisma.attendance.findMany({
    include: { user: { include: { team: true } } },
    orderBy: { date: 'desc' },
  });

  const teams = await prisma.team.findMany({ where: { isActive: true } });
  const employees = await prisma.user.findMany({ where: { isDeleted: false }, select: { id: true, fullName: true, employeeId: true } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Organization Attendance Ledger</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Real-time check-in and check-out logs, shift punctuality, and working hours
        </p>
      </div>

      <UnifiedAttendanceTable
        initialRecords={records}
        teams={teams}
        employees={employees}
        showTeamCol={true}
      />
    </div>
  );
}
