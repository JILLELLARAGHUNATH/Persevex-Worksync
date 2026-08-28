import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import StatusBadge from '@/components/common/StatusBadge';
import { Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TLTeamMembersPage() {
  const session = await getSession();

  const ledTeams = await prisma.team.findMany({
    where: {
      OR: [
        { teamLeadId: session?.id },
        { id: session?.teamId || '' },
      ],
      isActive: true,
    },
    select: { id: true },
  });
  const ledTeamIds = ledTeams.map((t) => t.id);

  const members = ledTeamIds.length > 0
    ? await prisma.user.findMany({
        where: {
          teamId: { in: ledTeamIds },
          isDeleted: false,
        },
        include: {
          team: true,
        },
        orderBy: { fullName: 'asc' },
      })
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Squad Team Members</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Engineers and contributors under your leadership
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 text-xs font-semibold">
          <Users className="w-3.5 h-3.5" /> {members.length} Assigned Contributors
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-950/80 uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-4">Member</th>
              <th className="p-4">Employee ID</th>
              <th className="p-4">Designation</th>
              <th className="p-4">Squad</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Joined Date</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {members.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  No squad members assigned to your leadership yet.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 border border-blue-500/20 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-xs">
                        {m.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{m.fullName}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono font-medium text-slate-700 dark:text-slate-300">{m.employeeId}</td>
                  <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{m.designation}</td>
                  <td className="p-4">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{m.team?.name || 'Core Squad'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{m.team?.code || ''}</p>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 font-mono">
                    {m.phone || '—'}
                  </td>
                  <td className="p-4 font-mono text-slate-500 dark:text-slate-400">
                    {formatDate(m.createdAt)}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={m.accountStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}