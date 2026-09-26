import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import UnifiedReportsClient from '@/components/reports/UnifiedReportsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TLReportsPage() {
  const session = await getSession();
  const team = await prisma.team.findFirst({
    where: { OR: [{ teamLeadId: session?.id }, { id: session?.teamId || '' }] },
    include: { members: { where: { isDeleted: false } } },
  });

  const employees = team?.members || [];

  return (
    <div className="space-y-3">
      <div className="px-4 py-3 ws-card rounded-xl border-l-4 border-l-indigo-500">
        <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Team Reports &middot; {team?.name || 'My Squad'}</h1>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Export team shift logs and attendance records
        </p>
      </div>

      <UnifiedReportsClient role="TEAM_LEAD" teams={team ? [team] : []} employees={employees} />
    </div>
  );
}
