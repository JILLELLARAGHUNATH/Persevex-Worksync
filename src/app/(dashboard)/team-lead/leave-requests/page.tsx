import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import LeaveRequestsClient from '@/components/leaves/LeaveRequestsClient';

export default async function TLLeavesPage() {
  const session = await getSession();

  const team = await prisma.team.findFirst({
    where: { OR: [{ teamLeadId: session?.id }, { id: session?.teamId || '' }] },
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      user: { teamId: team?.id || '' },
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Leave Requests</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Stage 1 review for team member leave applications
        </p>
      </div>

      <LeaveRequestsClient initialLeaves={leaves} role="TEAM_LEAD" />
    </div>
  );
}
