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
    <div className="space-y-3">
      {/* Compact page header */}
      <div className="flex items-center justify-between px-4 py-3 ws-card rounded-xl border-l-4 border-l-blue-500">
        <div>
          <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Employees &amp; Team Leads</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Workforce directory &mdash; search, filter, and manage all members</p>
        </div>
        <span className="text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800/60 font-mono shrink-0">
          {initialData.totalCount} Members
        </span>
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
