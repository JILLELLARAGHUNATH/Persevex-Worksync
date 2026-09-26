import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import TeamLeadDashboardClient from '@/components/attendance/TeamLeadDashboardClient';
import Link from 'next/link';
import { Calendar, Users, FileCheck2 } from 'lucide-react';
import PushNotificationToggle from '@/components/profile/PushNotificationToggle';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';
import { autoFinalizeForgottenAttendance } from '@/lib/autoCheckout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TeamLeadDashboardPage() {
  const session = await getSession();
  if (session?.id) {
    await autoFinalizeForgottenAttendance(session.id);
  }
  const india = getIndiaWorkdayInfo();

  const [currentUser, tlAttendance, ledTeams] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session!.id },
      include: { team: true },
    }),
    prisma.attendance.findFirst({
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
    }),
    prisma.team.findMany({
      where: {
        OR: [
          { teamLeadId: session?.id },
          { id: session?.teamId || '' },
        ],
        isActive: true,
      },
      select: { id: true, name: true },
    }),
  ]);

  const ledTeamIds = ledTeams.map((t) => t.id);
  const primaryTeamName = ledTeams[0]?.name || currentUser?.team?.name || 'Squad';

  // 2. Resolve team members and pending leaves in parallel
  const [assignedMembers, pendingTlLeaves] = await Promise.all([
    ledTeamIds.length > 0
      ? prisma.user.findMany({
          where: {
            teamId: { in: ledTeamIds },
            isDeleted: false,
          },
          include: {
            team: true,
          },
          orderBy: { fullName: 'asc' },
        })
      : Promise.resolve([]),
    ledTeamIds.length > 0
      ? prisma.leaveRequest.count({
          where: {
            currentStage: 'PENDING_TL',
            user: { teamId: { in: ledTeamIds } },
          },
        })
      : Promise.resolve(0),
  ]);

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

  const now = new Date();
  const hour = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  const h = parseInt(hour, 10);
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetingEmoji = h < 12 ? '☀️' : h < 17 ? '🌤️' : '🌙';

  const firstName = session?.fullName?.split(' ')[0] || 'Team Lead';

  return (
    <div className="space-y-3">
      {/* Compact hero greeting */}
      <div className="ws-hero rounded-xl px-4 py-3 sm:px-6 sm:py-4 ws-animate-fade-up">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-indigo-200 text-[11px] font-medium tracking-wide">{greetingEmoji} {greeting}</p>
              <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">{firstName}</h1>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-white bg-white/10 px-2.5 py-1 rounded-lg border border-white/20 font-semibold">
                <Users className="w-3 h-3" /> {primaryTeamName}
              </span>
              <span className="text-xs text-indigo-200/80">{assignedMembers.length} members</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/team-lead/work-calendar" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-xs transition border border-white/20">
              <Calendar className="w-3.5 h-3.5" /> Calendar
            </Link>
            <Link href="/team-lead/team-members" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-xs transition border border-white/20">
              <Users className="w-3.5 h-3.5" /> Squad ({assignedMembers.length})
            </Link>
            <Link href="/team-lead/leave-requests" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs transition shadow-md">
              <FileCheck2 className="w-3.5 h-3.5" /> Leaves
              {pendingTlLeaves > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{pendingTlLeaves}</span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Push-In Reminder Setup Card (shown only if not enabled on this device) */}
      <PushNotificationToggle userRole={session?.role ?? 'TEAM_LEAD'} variant="dashboard" />

      {/* ─── TEAM LEAD DASHBOARD CLIENT ─── */}
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