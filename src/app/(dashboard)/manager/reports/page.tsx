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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reporting Center</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Generate and download custom attendance, roster, and leave reports in Excel or CSV
        </p>
      </div>

      <UnifiedReportsClient role="MANAGER" teams={teams} employees={employees} />
    </div>
  );
}
