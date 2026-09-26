import { prisma } from '@/lib/prisma';
import UnifiedReportsClient from '@/components/reports/UnifiedReportsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerReportsPage() {
  const [teams, employees] = await Promise.all([
    prisma.team.findMany({ where: { isActive: true } }),
    prisma.user.findMany({ where: { isDeleted: false }, select: { id: true, fullName: true, employeeId: true } }),
  ]);

  return (
    <div className="space-y-3">
      <div className="px-4 py-3 ws-card rounded-xl border-l-4 border-l-indigo-500">
        <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Reporting Center</h1>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Generate and download custom attendance, roster, and leave reports in Excel or CSV</p>
      </div>

      <UnifiedReportsClient role="MANAGER" teams={teams} employees={employees} />
    </div>
  );
}
