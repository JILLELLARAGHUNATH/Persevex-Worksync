import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';
import { checkInAction, checkOutAction } from '@/actions/attendanceActions';
import { autoFinalizeForgottenAttendance } from '@/lib/autoCheckout';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    // Auto-finalize any past or late-night forgotten checkouts for this user
    await autoFinalizeForgottenAttendance(session.id);

    const now = new Date();
    const india = getIndiaWorkdayInfo(now);

    const record = await prisma.attendance.findFirst({
      where: {
        userId: session.id,
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

    return NextResponse.json(
      {
        success: true,
        data: record || null,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Attendance GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load attendance.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const op = (body.op || '').toString().toLowerCase();

    // CLOCK OUT
    if (op === 'checkout' || op === 'check_out' || op === 'check-out') {
      const res = await checkOutAction(body?.coords || null);
      return NextResponse.json(res, {
        status: res?.success ? 200 : 400,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // CLOCK IN
    const coords = body?.coords || null;
    const res = await checkInAction(coords);

    return NextResponse.json(res, {
      status: res?.success ? 200 : 400,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Attendance POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Attendance operation failed.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
