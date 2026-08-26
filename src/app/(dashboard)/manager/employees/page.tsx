import { prisma } from '@/lib/prisma';
import EmployeeTable from '@/components/employees/EmployeeTable';

export default async function ManagerEmployeesPage() {
  const employees = await prisma.user.findMany({
    where: { isDeleted: false },
    include: { team: { include: { teamLead: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const teams = await prisma.team.findMany({ where: { isActive: true } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Employees & Team Leads</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Directory of all registered workforce members ({employees.length} total)
        </p>
      </div>

      <EmployeeTable initialEmployees={employees} teams={teams} canManage={true} />
    </div>
  );
}
