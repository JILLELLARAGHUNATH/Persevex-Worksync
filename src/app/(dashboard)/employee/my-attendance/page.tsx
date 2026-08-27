import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import UnifiedAttendanceTable from '@/components/attendance/UnifiedAttendanceTable';

export default async function EmployeeMyAttendancePage() {
  const session = await getSession();
  if (!session) return null;

  const history = await prisma.attendance.findMany({
    where: { userId: session.id },
    include: { user: true },
    orderBy: { date: 'desc' },
  });

  const totalShifts = history.filter((h) => h.status === 'PRESENT').length;
  const onTimeCount = history.filter((h) => h.lateStatus === 'ON_TIME' && h.checkInTime).length;
  const lateCount = history.filter((h) => h.lateStatus === 'LATE').length;
  const totalHours = history.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">My Attendance History</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Personal shift history ledger, working hours, and punctuality compliance
        </p>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed Days</span>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalShifts}</h3>
          <p className="text-[11px] text-slate-400 font-medium">Logged present</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">On-Time</span>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{onTimeCount}</h3>
          <p className="text-[11px] text-slate-400 font-medium">By 11:15 AM</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Late Arrivals</span>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{lateCount}</h3>
          <p className="text-[11px] text-slate-400 font-medium">After grace cutoff</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Working Hours</span>
          <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{totalHours.toFixed(1)} hrs</h3>
          <p className="text-[11px] text-slate-400 font-medium">Cumulative duration</p>
        </div>
      </div>

      <div className="space-y-3">
        <UnifiedAttendanceTable initialRecords={history} showTeamCol={false} currentUserId={session.id} />
      </div>
    </div>
  );
}

