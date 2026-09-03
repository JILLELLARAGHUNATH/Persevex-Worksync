import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processLeaveApprovalAction } from '@/actions/leaveActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const normalizedAction = String(action).toUpperCase() === 'REJECT' ? 'REJECT' : 'APPROVE';

    const res = await processLeaveApprovalAction(id, normalizedAction, comments);
    if (!res.success) {
      return NextResponse.json({ success: false, message: res.error || 'Failed to process leave' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: res.leave });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Failed to process leave' }, { status: 500 });
  }
}