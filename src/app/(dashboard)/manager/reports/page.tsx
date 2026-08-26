import { prisma } from '@/lib/prisma';
import UnifiedReportsClient from '@/components/reports/UnifiedReportsClient';

export default async function ManagerReportsPage() {
  const teams = await prisma.team.findMany({ where: { isActive: true } });
  const employees = await prisma.user.findMany({ where: { isDeleted: false }, select: { id: true, fullName: true, employeeId: true } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Reporting Center</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Generate and download custom attendance, roster, and leave reports in Excel or CSV
        </p>
      </div>

      <UnifiedReportsClient role="MANAGER" teams={teams} employees={employees} />
    </div>
  );
}
