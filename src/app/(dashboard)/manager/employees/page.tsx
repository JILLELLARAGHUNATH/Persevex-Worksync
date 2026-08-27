import { prisma } from '@/lib/prisma';
import EmployeeTable from '@/components/employees/EmployeeTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerEmployeesPage() {

  const employees = await prisma.user.findMany({
    where: { isDeleted: false },
    include: { team: { include: { teamLead: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const teams = await prisma.team.findMany({ where: { isActive: true } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Employees & Team Leads</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Directory of all registered workforce members ({employees.length} total)
        </p>
      </div>

      <EmployeeTable initialEmployees={employees} teams={teams} canManage={true} />
    </div>
  );
}
