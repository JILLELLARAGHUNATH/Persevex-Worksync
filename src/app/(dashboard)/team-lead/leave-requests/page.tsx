import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import LeaveRequestsClient from '@/components/leaves/LeaveRequestsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TLLeavesPage() {
  const session = await getSession();

  // Find teams led by or associated with this Team Lead
  const ledTeams = await prisma.team.findMany({
    where: {
      OR: [
        { teamLeadId: session?.id },
        { id: session?.teamId || '' },
      ],
      isActive: true,
    },
    select: { id: true, name: true },
  });

  const ledTeamIds = ledTeams.map((t) => t.id);

  // Load only squad members assigned to this Team Lead
  const assignedMembers = ledTeamIds.length > 0
    ? await prisma.user.findMany({
        where: {
          teamId: { in: ledTeamIds },
          isDeleted: false,
        },
        select: { id: true, fullName: true, employeeId: true, teamId: true },
        orderBy: { fullName: 'asc' },
      })
    : [];

  const leaves = ledTeamIds.length > 0
    ? await prisma.leaveRequest.findMany({
        where: {
          user: { teamId: { in: ledTeamIds } },
        },
        include: { user: { include: { team: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Leave Requests</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Stage 1 review for team member leave applications
        </p>
      </div>

      <LeaveRequestsClient
        initialLeaves={leaves}
        initialEmployees={assignedMembers}
        role="TEAM_LEAD"
      />
    </div>
  );
}

