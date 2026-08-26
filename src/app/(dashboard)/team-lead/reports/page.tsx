import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import UnifiedReportsClient from '@/components/reports/UnifiedReportsClient';

export default async function TLReportsPage() {
  const session = await getSession();
  const team = await prisma.team.findFirst({
    where: { OR: [{ teamLeadId: session?.id }, { id: session?.teamId || '' }] },
    include: { members: { where: { isDeleted: false } } },
  });

  const employees = team?.members || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Team Reports � {team?.name || 'My Team'}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Export team shift logs and attendance records
        </p>
      </div>

      <UnifiedReportsClient role="TEAM_LEAD" teams={team ? [team] : []} employees={employees} />
    </div>
  );
}
