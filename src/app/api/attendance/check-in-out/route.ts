import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkInAction, checkOutAction } from '@/actions/attendanceActions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const utcToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));

  // Robust check matching UTC date, local date, or today checkIn timestamp
  const record = await prisma.attendance.findFirst({
    where: {
      userId: session.id,
      OR: [
        { date: utcToday },
        { date: startOfToday },
        { date: { gte: startOfToday, lte: endOfToday } },
        { checkInTime: { gte: startOfToday, lte: endOfToday } },
      ],
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: record || null });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const op = (body.op || '').toString().toLowerCase();

  if (op === 'checkout' || op === 'check_out' || op === 'check-out') {
    const res = await checkOutAction();
    return NextResponse.json(res, res?.success ? { status: 200 } : { status: 400 });
  }

  const coords = body?.coords || null;
  const res = await checkInAction(coords);
  return NextResponse.json(res, res?.success ? { status: 200 } : { status: 400 });
}