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

    // Query all entities updated since sinceDate in parallel
    const [attendances, leaves, users, announcements, teams, auditLogs, notifications] = await Promise.all([
      prisma.attendance.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: {
          user: {
            include: { team: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
      prisma.leaveRequest.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: {
          user: {
            include: { team: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
      prisma.user.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: {
          team: {
            include: { teamLead: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
      prisma.announcement.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: {
          createdBy: true,
          reads: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.team.findMany({
        where: { updatedAt: { gt: sinceDate } },
        include: {
          teamLead: true,
          members: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      }),
      prisma.auditLog.findMany({
        where: {
          timestamp: { gt: sinceDate },
          action: { in: ['ANNOUNCEMENT_DELETED', 'ANNOUNCEMENT_CREATED', 'TEAM_DELETED', 'EMPLOYEE_DELETED'] },
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
      prisma.notification.findMany({
        where: {
          userId: session.id,
          createdAt: { gt: sinceDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
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
