import { getSession } from '@/lib/auth';
import UnifiedReportsClient from '@/components/reports/UnifiedReportsClient';

export default async function EmployeeReportsPage() {
  const session = await getSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">My Attendance Reports</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Export your personal punch ledger and working hours
        </p>
      </div>

      <UnifiedReportsClient role="EMPLOYEE" />
    </div>
  );
}
