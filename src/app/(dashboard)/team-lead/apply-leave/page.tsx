import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import ApplyLeaveClient from '@/components/leaves/ApplyLeaveClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TeamLeadApplyLeavePage() {
  const session = await getSession();
  if (!session || (session.role !== 'TEAM_LEAD' && session.role !== 'MANAGER')) {
    redirect('/login');
  }

  const [balances, history] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId: session.id, year: new Date().getFullYear() },
    }),
    prisma.leaveRequest.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Apply for Leave</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Submit a personal leave application for Management review and approval
        </p>
      </div>

      <ApplyLeaveClient balances={balances} history={history} />
    </div>
  );
}
