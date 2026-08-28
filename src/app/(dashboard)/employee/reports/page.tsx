import { getSession } from '@/lib/auth';
import UnifiedReportsClient from '@/components/reports/UnifiedReportsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmployeeReportsPage() {
  const session = await getSession();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Attendance Reports</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Export your personal punch ledger and working hours
        </p>
      </div>

      <UnifiedReportsClient role="EMPLOYEE" />
    </div>
  );
}
