import { prisma } from '@/lib/prisma';
import EmployeeTable from '@/components/employees/EmployeeTable';
import { getEmployeesPaginatedAction } from '@/actions/employeeActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerEmployeesPage() {
  const [initialData, teams] = await Promise.all([
    getEmployeesPaginatedAction({ page: 1, pageSize: 20 }),
    prisma.team.findMany({ where: { isActive: true }, include: { teamLead: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Employees & Team Leads</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Directory of all registered workforce members ({initialData.totalCount} total)
        </p>
      </div>

      <EmployeeTable
        initialEmployees={initialData.employees}
        initialTotalCount={initialData.totalCount}
        initialPage={initialData.page}
        initialPageSize={initialData.pageSize}
        teams={teams}
        canManage={true}
      />
    </div>
  );
}
