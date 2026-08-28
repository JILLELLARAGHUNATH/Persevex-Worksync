import { prisma } from '@/lib/prisma';
import TeamsManagementClient from '@/components/teams/TeamsManagementClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerTeamsPage() {
  const [teams, allUsers] = await Promise.all([
    prisma.team.findMany({
      include: {
        teamLead: true,
        members: { where: { isDeleted: false } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { isDeleted: false },
      include: { team: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Management</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Create teams, assign Team Leads, and manage team member rosters
        </p>
      </div>

      <TeamsManagementClient initialTeams={teams} allUsers={allUsers} />
    </div>
  );
}
