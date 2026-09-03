import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const role = session.role;
    const teamId = session.teamId;

    // Role-optimized parallel delta queries
    let attendancesPromise: Promise<any[]>;
    let leavesPromise: Promise<any[]>;
    let usersPromise: Promise<any[]> = Promise.resolve([]);
    let announcementsPromise: Promise<any[]>;
    let teamsPromise: Promise<any[]> = Promise.resolve([]);
    let auditLogsPromise: Promise<any[]>;
    let notificationsPromise: Promise<any[]>;

    if (role === 'EMPLOYEE') {
      // Employees only query own attendance, own leaves, targeted announcements, and own notifications
      attendancesPromise = prisma.attendance.findMany({
        where: { userId: session.id, updatedAt: { gt: sinceDate } },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      leavesPromise = prisma.leaveRequest.findMany({
        where: { userId: session.id, updatedAt: { gt: sinceDate } },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
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
        take: 10,
      });

      auditLogsPromise = prisma.auditLog.findMany({
        where: { timestamp: { gt: sinceDate }, action: 'ANNOUNCEMENT_DELETED' },
        orderBy: { timestamp: 'desc' },
        take: 5,
      });

      notificationsPromise = prisma.notification.findMany({
        where: { userId: session.id, createdAt: { gt: sinceDate } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } else if (role === 'TEAM_LEAD') {
      // Team Leads query squad attendance, squad leaves, squad users, announcements, and own notifications
      attendancesPromise = prisma.attendance.findMany({
        where: {
          OR: [{ userId: session.id }, ...(teamId ? [{ user: { teamId } }] : [])],
          updatedAt: { gt: sinceDate },
        },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });

      leavesPromise = prisma.leaveRequest.findMany({
        where: {
          OR: [{ userId: session.id }, ...(teamId ? [{ user: { teamId } }] : [])],
          updatedAt: { gt: sinceDate },
        },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });

      if (teamId) {
        usersPromise = prisma.user.findMany({
          where: { teamId, updatedAt: { gt: sinceDate } },
          include: { team: { include: { teamLead: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        });
      }

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
        take: 15,
      });

      auditLogsPromise = prisma.auditLog.findMany({
        where: { timestamp: { gt: sinceDate }, action: { in: ['ANNOUNCEMENT_DELETED', 'EMPLOYEE_DELETED'] } },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      notificationsPromise = prisma.notification.findMany({
        where: { userId: session.id, createdAt: { gt: sinceDate } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      });
    } else {
      // Managers query organization-wide data across all models
      attendancesPromise = prisma.attendance.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      });

      leavesPromise = prisma.leaveRequest.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { user: { include: { team: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      });

      usersPromise = prisma.user.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { team: { include: { teamLead: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      });

      announcementsPromise = prisma.announcement.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { createdBy: true, reads: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });

      teamsPromise = prisma.team.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: { teamLead: true, members: true },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      });

      auditLogsPromise = prisma.auditLog.findMany({
        where: {
          timestamp: { gt: sinceDate },
          action: { in: ['ANNOUNCEMENT_DELETED', 'ANNOUNCEMENT_CREATED', 'TEAM_DELETED', 'EMPLOYEE_DELETED'] },
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
      });

      notificationsPromise = prisma.notification.findMany({
        where: { userId: session.id, createdAt: { gt: sinceDate } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      });
    }

    const [attendances, leaves, users, announcements, teams, auditLogs, notifications] = await Promise.all([
      attendancesPromise,
      leavesPromise,
      usersPromise,
      announcementsPromise,
      teamsPromise,
      auditLogsPromise,
      notificationsPromise,
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

    return NextResponse.json(
      {
        success: true,
        hasChanges: events.length > 0,
        serverTime: now.toISOString(),
        serverTimestamp: now.getTime(),
        events,
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
