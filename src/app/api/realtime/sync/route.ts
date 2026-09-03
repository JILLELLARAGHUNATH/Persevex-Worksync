import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get('since');
    
    // Default to 15 seconds ago if sinceParam is missing or invalid
    let sinceDate: Date;
    if (sinceParam) {
      const parsed = new Date(isNaN(Number(sinceParam)) ? sinceParam : Number(sinceParam));
      sinceDate = isNaN(parsed.getTime()) ? new Date(Date.now() - 15000) : parsed;
    } else {
      sinceDate = new Date(Date.now() - 15000);
    }

    const now = new Date();
    const india = getIndiaWorkdayInfo(now);
    const role = session.role;
    const teamId = session.teamId;

    // Resolve squad team IDs if Team Lead
    let squadTeamIds: string[] = [];
    if (role === 'TEAM_LEAD') {
      const ledTeams = await prisma.team.findMany({
        where: {
          OR: [
            { teamLeadId: session.id },
            ...(teamId ? [{ id: teamId }] : []),
          ],
          isActive: true,
        },
        select: { id: true },
      });
      squadTeamIds = ledTeams.map((t) => t.id);
    }

    // Role-optimized parallel delta queries
    let attendancesPromise: Promise<any[]>;
    let leavesPromise: Promise<any[]>;
    let usersPromise: Promise<any[]> = Promise.resolve([]);
    let announcementsPromise: Promise<any[]>;
    let teamsPromise: Promise<any[]> = Promise.resolve([]);
    let auditLogsPromise: Promise<any[]>;
    let notificationsPromise: Promise<any[]>;

    // Active snapshot promises for instant direct DB deletion & edit reconciliation
    let todayAttendancesPromise: Promise<any[]>;
    let activeAnnouncementsPromise: Promise<any[]>;
    let activeLeavesPromise: Promise<any[]>;
    let unreadCountPromise: Promise<number>;

    if (role === 'EMPLOYEE') {
      attendancesPromise = prisma.attendance.findMany({
        where: { userId: session.id, updatedAt: { gt: sinceDate } },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      leavesPromise = prisma.leaveRequest.findMany({
        where: { userId: session.id, updatedAt: { gt: sinceDate } },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      announcementsPromise = prisma.announcement.findMany({
        where: {
          updatedAt: { gt: sinceDate },
          OR: [
            { targetType: 'ALL' },
            ...(teamId ? [{ targetType: 'TEAM', targetId: teamId }] : []),
            { targetType: 'SPECIFIC_EMPLOYEES', targetId: session.id },
          ],
        },
        include: { createdBy: true, reads: true },
        orderBy: { updatedAt: 'desc' },
      });

      auditLogsPromise = prisma.auditLog.findMany({
        where: { timestamp: { gt: sinceDate }, action: 'ANNOUNCEMENT_DELETED' },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      notificationsPromise = prisma.notification.findMany({
        where: { userId: session.id, createdAt: { gt: sinceDate } },
        orderBy: { createdAt: 'desc' },
      });

      todayAttendancesPromise = prisma.attendance.findMany({
        where: { userId: session.id, date: india.canonicalDate },
        select: {
          id: true,
          userId: true,
          date: true,
          checkInTime: true,
          checkOutTime: true,
          totalHours: true,
          status: true,
          lateStatus: true,
          updatedAt: true,
        },
      });

      activeAnnouncementsPromise = prisma.announcement.findMany({
        where: {
          OR: [
            { targetType: 'ALL' },
            ...(teamId ? [{ targetType: 'TEAM', targetId: teamId }] : []),
            { targetType: 'SPECIFIC_EMPLOYEES', targetId: session.id },
          ],
        },
        select: { id: true },
      });

      activeLeavesPromise = prisma.leaveRequest.findMany({
        where: { userId: session.id },
        select: { id: true, currentStage: true },
      });

      unreadCountPromise = prisma.notification.count({
        where: { userId: session.id, isRead: false },
      });
    } else if (role === 'TEAM_LEAD') {
      attendancesPromise = prisma.attendance.findMany({
        where: {
          OR: [
            { userId: session.id },
            ...(squadTeamIds.length > 0 ? [{ user: { teamId: { in: squadTeamIds } } }] : []),
          ],
          updatedAt: { gt: sinceDate },
        },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      leavesPromise = prisma.leaveRequest.findMany({
        where: {
          OR: [
            { userId: session.id },
            ...(squadTeamIds.length > 0 ? [{ user: { teamId: { in: squadTeamIds } } }] : []),
          ],
          updatedAt: { gt: sinceDate },
        },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      if (squadTeamIds.length > 0) {
        usersPromise = prisma.user.findMany({
          where: {
            OR: [
              { teamId: { in: squadTeamIds } },
              { id: session.id },
            ],
            updatedAt: { gt: sinceDate },
          },
          include: { team: { include: { teamLead: true } } },
          orderBy: { updatedAt: 'desc' },
        });
      }

      announcementsPromise = prisma.announcement.findMany({
        where: {
          updatedAt: { gt: sinceDate },
          OR: [
            { targetType: 'ALL' },
            ...(squadTeamIds.length > 0 ? [{ targetType: 'TEAM', targetId: { in: squadTeamIds } }] : []),
            { targetType: 'SPECIFIC_EMPLOYEES', targetId: session.id },
          ],
        },
        include: { createdBy: true, reads: true },
        orderBy: { updatedAt: 'desc' },
      });

      auditLogsPromise = prisma.auditLog.findMany({
        where: { timestamp: { gt: sinceDate }, action: { in: ['ANNOUNCEMENT_DELETED', 'EMPLOYEE_DELETED'] } },
        orderBy: { timestamp: 'desc' },
        take: 15,
      });

      notificationsPromise = prisma.notification.findMany({
        where: { userId: session.id, createdAt: { gt: sinceDate } },
        orderBy: { createdAt: 'desc' },
      });

      todayAttendancesPromise = prisma.attendance.findMany({
        where: {
          OR: [
            { userId: session.id },
            ...(squadTeamIds.length > 0 ? [{ user: { teamId: { in: squadTeamIds } } }] : []),
          ],
          date: india.canonicalDate,
        },
        select: {
          id: true,
          userId: true,
          date: true,
          checkInTime: true,
          checkOutTime: true,
          totalHours: true,
          status: true,
          lateStatus: true,
          updatedAt: true,
        },
      });

      activeAnnouncementsPromise = prisma.announcement.findMany({
        where: {
          OR: [
            { targetType: 'ALL' },
            ...(squadTeamIds.length > 0 ? [{ targetType: 'TEAM', targetId: { in: squadTeamIds } }] : []),
            { targetType: 'SPECIFIC_EMPLOYEES', targetId: session.id },
          ],
        },
        select: { id: true },
      });

      activeLeavesPromise = prisma.leaveRequest.findMany({
        where: {
          OR: [
            { userId: session.id },
            ...(squadTeamIds.length > 0 ? [{ user: { teamId: { in: squadTeamIds } } }] : []),
          ],
        },
        select: { id: true, currentStage: true },
      });

      unreadCountPromise = prisma.notification.count({
        where: { userId: session.id, isRead: false },
      });
    } else {
      // MANAGER: Organization-wide unthrottled queries
      attendancesPromise = prisma.attendance.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      leavesPromise = prisma.leaveRequest.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      usersPromise = prisma.user.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { team: { include: { teamLead: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      announcementsPromise = prisma.announcement.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { createdBy: true, reads: true },
        orderBy: { updatedAt: 'desc' },
      });

      teamsPromise = prisma.team.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { teamLead: true, members: true },
        orderBy: { updatedAt: 'desc' },
      });

      auditLogsPromise = prisma.auditLog.findMany({
        where: {
          timestamp: { gt: sinceDate },
          action: { in: ['ANNOUNCEMENT_DELETED', 'ANNOUNCEMENT_CREATED', 'TEAM_DELETED', 'EMPLOYEE_DELETED'] },
        },
        orderBy: { timestamp: 'desc' },
        take: 30,
      });

      notificationsPromise = prisma.notification.findMany({
        where: { userId: session.id, createdAt: { gt: sinceDate } },
        orderBy: { createdAt: 'desc' },
      });

      todayAttendancesPromise = prisma.attendance.findMany({
        where: { date: india.canonicalDate },
        select: {
          id: true,
          userId: true,
          date: true,
          checkInTime: true,
          checkOutTime: true,
          totalHours: true,
          status: true,
          lateStatus: true,
          updatedAt: true,
        },
      });

      activeAnnouncementsPromise = prisma.announcement.findMany({
        select: { id: true },
      });

      activeLeavesPromise = prisma.leaveRequest.findMany({
        select: { id: true, currentStage: true },
      });

      unreadCountPromise = prisma.notification.count({
        where: { userId: session.id, isRead: false },
      });
    }

    const [
      attendances,
      leaves,
      users,
      announcements,
      teams,
      auditLogs,
      notifications,
      todayAttendances,
      activeAnnouncements,
      activeLeaves,
      unreadNotificationCount,
    ] = await Promise.all([
      attendancesPromise,
      leavesPromise,
      usersPromise,
      announcementsPromise,
      teamsPromise,
      auditLogsPromise,
      notificationsPromise,
      todayAttendancesPromise,
      activeAnnouncementsPromise,
      activeLeavesPromise,
      unreadCountPromise,
    ]);

    const events: Array<{ type: string; payload: any; timestamp: number }> = [];

    // Map attendances
    for (const att of attendances) {
      events.push({
        type: 'ATTENDANCE_UPDATE',
        payload: {
          status: att.checkOutTime ? 'CHECKED_OUT' : 'CHECKED_IN',
          attendance: att,
          userId: att.userId,
          teamLeadId: att.user?.teamId,
        },
        timestamp: att.updatedAt.getTime(),
      });
    }

    // Map leaves
    for (const leave of leaves) {
      events.push({
        type: 'LEAVE_STATUS_CHANGED',
        payload: {
          leaveId: leave.id,
          stage: leave.currentStage,
          leave,
        },
        timestamp: leave.updatedAt.getTime(),
      });
    }

    // Map users
    for (const u of users) {
      events.push({
        type: 'WORKFORCE_UPDATE',
        payload: {
          action: u.isDeleted ? 'EMPLOYEE_DELETED' : 'EMPLOYEE_UPDATED',
          user: u,
          userId: u.id,
        },
        timestamp: u.updatedAt.getTime(),
      });
    }

    // Map announcements
    for (const ann of announcements) {
      events.push({
        type: 'SYSTEM_ANNOUNCEMENT',
        payload: {
          type: 'ANNOUNCEMENT_CREATED',
          announcement: ann,
        },
        timestamp: ann.updatedAt.getTime(),
      });
    }

    // Map audit logs (specifically deletions and critical mutations)
    for (const log of auditLogs) {
      if (log.action === 'ANNOUNCEMENT_DELETED') {
        events.push({
          type: 'SYSTEM_ANNOUNCEMENT',
          payload: {
            type: 'ANNOUNCEMENT_DELETED',
            announcementId: log.target,
          },
          timestamp: log.timestamp.getTime(),
        });
      }
    }

    // Map user notifications
    for (const notif of notifications) {
      events.push({
        type: 'NOTIFICATION_RECEIVED',
        payload: {
          notification: notif,
        },
        timestamp: notif.createdAt.getTime(),
      });
    }

    // Map teams
    for (const tm of teams) {
      events.push({
        type: 'WORKFORCE_UPDATE',
        payload: {
          action: 'TEAM_UPDATED',
          team: tm,
          teamId: tm.id,
        },
        timestamp: tm.updatedAt.getTime(),
      });
    }

    // Sort events chronologically
    events.sort((a, b) => a.timestamp - b.timestamp);

    // Build today's attendance summary map
    const todayAttendanceMap: Record<string, any> = {};
    for (const att of todayAttendances) {
      todayAttendanceMap[att.userId] = att;
    }

    return NextResponse.json(
      {
        success: true,
        hasChanges: events.length > 0,
        serverTime: now.toISOString(),
        serverTimestamp: now.getTime(),
        events,
        snapshot: {
          todayAttendanceMap,
          todayAttendanceIds: todayAttendances.map((a) => a.id),
          todayAttendanceUserIds: todayAttendances.map((a) => a.userId),
          activeAnnouncementIds: activeAnnouncements.map((a) => a.id),
          activeLeaveIds: activeLeaves.map((l) => l.id),
          unreadNotificationCount,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Realtime sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Sync error',
        serverTime: new Date().toISOString(),
        serverTimestamp: Date.now(),
        events: [],
        snapshot: null,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

