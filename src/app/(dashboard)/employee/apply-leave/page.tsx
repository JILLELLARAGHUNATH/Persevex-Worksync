import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import ApplyLeaveClient from '@/components/leaves/ApplyLeaveClient';

export default async function ApplyLeavePage() {
  const session = await getSession();

  const balances = await prisma.leaveBalance.findMany({
    where: { userId: session!.id, year: new Date().getFullYear() },
  });

  const history = await prisma.leaveRequest.findMany({
    where: { userId: session!.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Apply for Leave</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Submit a leave application and review your previous request statuses
        </p>
      </div>

      <ApplyLeaveClient balances={balances} history={history} />
    </div>
  );
}
