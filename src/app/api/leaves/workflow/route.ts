import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { appEvents, EVENT_TYPES } from '@/lib/events';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  let whereClause: any = {};
  if (session.role === 'TEAM_LEAD') {
    whereClause = { user: { teamId: session.teamId } };
  } else if (session.role === 'EMPLOYEE') {
    whereClause = { userId: session.id };
  }

  try {
    const leaves = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, fullName: true, employeeId: true, email: true, team: true } },
        approvals: { include: { actionBy: { select: { id: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, data: leaves });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Failed to fetch leaves' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const { id, action, comments } = await request.json();
    const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { user: true } });
    if (!leave) return NextResponse.json({ success: false, message: 'Leave not found' }, { status: 404 });

    const normalizedAction = String(action).toUpperCase();
    let nextStage = leave.currentStage;

    if (normalizedAction === 'REJECT') {
      nextStage = 'REJECTED';
    } else {
      if (session.role === 'TEAM_LEAD' && leave.currentStage === 'PENDING_TL') {
        nextStage = 'PENDING_MANAGER';
      } else if (session.role === 'MANAGER') {
        nextStage = 'APPROVED';
      }
    }

    if (nextStage === 'APPROVED') {
      await prisma.leaveBalance.updateMany({
        where: { userId: leave.userId, leaveType: leave.leaveType, year: new Date().getFullYear() },
        data: { usedQuota: { increment: leave.numberOfDays } },
      });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { currentStage: nextStage },
      include: { user: { include: { team: true } } },
    });

    appEvents.emit(EVENT_TYPES.LEAVE_STATUS_CHANGED, { leaveId: id, stage: nextStage, leave: updated });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Failed to process leave' }, { status: 500 });
  }
}