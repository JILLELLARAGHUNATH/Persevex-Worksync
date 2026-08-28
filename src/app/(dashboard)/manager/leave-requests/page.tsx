import { prisma } from '@/lib/prisma';
import LeaveRequestsClient from '@/components/leaves/LeaveRequestsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerLeaveRequestsPage() {
  const leaves = await prisma.leaveRequest.findMany({
    include: { user: { include: { team: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Leave Requests & Approvals</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Review and execute final decisions on workforce leave applications
        </p>
      </div>

      <LeaveRequestsClient initialLeaves={leaves} role="MANAGER" />
    </div>
  );
}
