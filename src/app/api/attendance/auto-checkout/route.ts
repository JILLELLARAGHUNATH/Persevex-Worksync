import { NextRequest, NextResponse } from 'next/server';
import { autoFinalizeForgottenAttendance } from '@/lib/autoCheckout';
import { appEvents, EVENT_TYPES } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Endpoint for automated 11:00 PM IST checkout of forgotten checkouts.
 * Triggered daily via Vercel Cron at 17:30 UTC (11:00 PM IST).
 * 
 * Protected by CRON_SECRET when configured in environment variables.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify CRON_SECRET if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      const queryKey = req.nextUrl.searchParams.get('key') || req.nextUrl.searchParams.get('secret');
      const isBearerValid = authHeader === `Bearer ${cronSecret}`;
      const isQueryValid = queryKey === cronSecret;

      if (!isBearerValid && !isQueryValid) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Invalid or missing CRON_SECRET.' },
          { status: 401 }
        );
      }
    }

    const finalized = await autoFinalizeForgottenAttendance();

    if (finalized > 0) {
      try {
        appEvents.emit(EVENT_TYPES.ATTENDANCE_UPDATE, {
          status: 'AUTO_CHECKED_OUT',
          finalizedCount: finalized,
          timestamp: Date.now(),
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed auto-checkouts. Finalized ${finalized} records.`,
      finalizedCount: finalized,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Auto checkout route error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Auto checkout failed.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

