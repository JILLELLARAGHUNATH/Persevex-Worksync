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
    <div className="space-y-3">
      {/* Compact page header */}
      <div className="flex items-center justify-between px-4 py-3 ws-card rounded-xl border-l-4 border-l-indigo-500">
        <div>
          <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Team Management</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Create squads, assign Team Leads, and manage member rosters</p>
        </div>
        <span className="text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800/60 font-mono shrink-0">
          {teams.length} Teams
        </span>
      </div>

      <TeamsManagementClient initialTeams={teams} allUsers={allUsers} />
    </div>
  );
}
