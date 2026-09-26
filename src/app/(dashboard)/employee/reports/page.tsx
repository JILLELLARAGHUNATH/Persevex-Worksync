import { getSession } from '@/lib/auth';
import UnifiedReportsClient from '@/components/reports/UnifiedReportsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmployeeReportsPage() {
  const session = await getSession();

  return (
    <div className="space-y-3">
      <div className="px-4 py-3 ws-card rounded-xl border-l-4 border-l-indigo-500">
        <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">My Attendance Reports</h1>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Export your personal punch ledger and working hours
        </p>
      </div>

      <UnifiedReportsClient role="EMPLOYEE" />
    </div>
  );
}
