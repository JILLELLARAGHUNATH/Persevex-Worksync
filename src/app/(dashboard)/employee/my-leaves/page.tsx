import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import StatusBadge from '@/components/common/StatusBadge';
import LeaveWorkflowTimeline from '@/components/leaves/LeaveWorkflowTimeline';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MyLeavesPage() {
  const session = await getSession();
  const leaves = await prisma.leaveRequest.findMany({
    where: { userId: session!.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Leave History & Status</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Track your applications through the multi-tier approval workflow</p>
        </div>
        <Link href="/employee/apply-leave" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-xs">
          + Apply New Leave
        </Link>
      </div>

      <div className="space-y-3">
        {leaves.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-xl text-center text-slate-400 text-xs shadow-xs">
            You have not submitted any leave requests yet.
          </div>
        ) : (
          leaves.map((leave) => (
            <div key={leave.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs transition-colors duration-150">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{leave.leaveType.replace(/_/g, ' ')}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{formatDate(leave.startDate)} &rarr; {formatDate(leave.endDate)} ({leave.numberOfDays} Days)</p>
                </div>
                <StatusBadge status={leave.currentStage} />
              </div>
              <LeaveWorkflowTimeline currentStage={leave.currentStage} />
              <div className="text-xs text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Reason:</span> {leave.reason}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}