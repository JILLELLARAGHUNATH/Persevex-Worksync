import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getMonthlyPayrollAction } from '@/actions/payrollActions';
import SalaryPayrollClient from '@/components/payroll/SalaryPayrollClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerSalaryPayrollPage() {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    redirect('/login');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [payrollRes, teams] = await Promise.all([
    getMonthlyPayrollAction({ year, month }),
    prisma.team.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const initialSummary = payrollRes.summary || {
    year,
    month,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
    totalEmployees: 0,
    totalMonthlySalary: 0,
    totalPayableSalary: 0,
    totalPaidLeaveDays: 0,
    totalUnpaidDays: 0,
    status: 'CALCULATED',
    employees: [],
  };

  return (
    <SalaryPayrollClient
      initialSummary={initialSummary}
      initialYear={year}
      initialMonth={month}
      teams={teams}
    />
  );
}
