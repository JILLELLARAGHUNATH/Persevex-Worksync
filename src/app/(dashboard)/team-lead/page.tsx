import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import TeamLeadDashboardClient from '@/components/attendance/TeamLeadDashboardClient';
import Link from 'next/link';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';

export default async function TeamLeadDashboardPage() {
  const session = await getSession();
  const india = getIndiaWorkdayInfo();

  const currentUser = await prisma.user.findUnique({
    where: { id: session!.id },
    include: { team: true },
  });

  const tlAttendance = await prisma.attendance.findFirst({
    where: {
      userId: session!.id,
      OR: [
        { date: india.canonicalDate },
        { date: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
        { checkInTime: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
      ],
    },
    include: {
      user: {
        include: { team: true },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });


  // 1. Resolve squads led by this Team Lead
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
  const primaryTeamName = ledTeams[0]?.name || currentUser?.team?.name || 'Squad';

  // 2. Resolve team members assigned to squads led by this Team Lead
  const assignedMembers = ledTeamIds.length > 0
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

  // Full squad pool including the Team Lead
  const fullSquadPool = [
    ...(currentUser ? [currentUser] : []),
    ...assignedMembers.filter((m) => m.id !== session?.id),
  ];
  const squadUserIds = fullSquadPool.map((m) => m.id);

  // 3. Resolve all attendance records for the Team Lead + squad members
  const initialAttendances = await prisma.attendance.findMany({
    where: {
      userId: { in: squadUserIds },
    },
    orderBy: { date: 'desc' },
  });

  // 4. Resolve pending leaves count
  const pendingTlLeaves = assignedMembers.length > 0
    ? await prisma.leaveRequest.count({
        where: {
          currentStage: 'PENDING_TL',
          userId: { in: squadUserIds },
        },
      })
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Team Lead Command Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {primaryTeamName} &middot; Real-Time Attendance & Workforce Operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/team-lead/team-members"
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition border border-slate-200 dark:border-slate-700"
          >
            Squad Members ({assignedMembers.length})
          </Link>
          <Link
            href="/team-lead/leave-requests"
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
          >
            Leave Requests ({pendingTlLeaves})
          </Link>
        </div>
      </div>

      {/* Main Team Lead Client (Compact Attendance Marker, Single Horizontal Bar Chart & Real-Time Sync) */}
      <TeamLeadDashboardClient
        teamMembers={fullSquadPool}
        initialAttendances={initialAttendances}
        tlAttendance={tlAttendance}
        currentUserId={session!.id}
        teamName={primaryTeamName}
      />
    </div>
  );
}