import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import StatusBadge from '@/components/common/StatusBadge';
import LeaveWorkflowTimeline from '@/components/leaves/LeaveWorkflowTimeline';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export default async function MyLeavesPage() {
  const session = await getSession();
  const leaves = await prisma.leaveRequest.findMany({
    where: { userId: session!.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">My Leave History & Status</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Track your applications through the multi-tier approval workflow</p>
        </div>
        <Link href="/employee/apply-leave" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-600/20">
          + Apply New Leave
        </Link>
      </div>

      <div className="space-y-4">
        {leaves.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 rounded-3xl text-center text-slate-400 text-xs shadow-sm">
            You have not submitted any leave requests yet.
          </div>
        ) : (
          leaves.map((leave) => (
            <div key={leave.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl transition-colors duration-200">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{leave.leaveType.replace(/_/g, ' ')}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{formatDate(leave.startDate)} &rarr; {formatDate(leave.endDate)} ({leave.numberOfDays} Days)</p>
                </div>
                <StatusBadge status={leave.currentStage} />
              </div>
              <LeaveWorkflowTimeline currentStage={leave.currentStage} />
              <div className="text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Reason:</span> {leave.reason}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}