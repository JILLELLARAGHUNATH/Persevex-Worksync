/**
 * /api/push/subscribe
 *
 * POST — Register a browser push subscription for the authenticated user.
 * DELETE — Remove a specific push subscription (unsubscribe on this device).
 *
 * Security:
 *  - Only the authenticated session owner may read/write their subscriptions.
 *  - Uses the existing JWT cookie auth (getSession).
 *  - No cross-user access is possible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ── POST /api/push/subscribe ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Only EMPLOYEE and TEAM_LEAD receive punch-in reminders.
  if (session.role === 'MANAGER') {
    return NextResponse.json(
      { success: false, error: 'Punch-in reminders are not available for Managers.' },
      { status: 403 }
    );
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { success: false, error: 'Missing endpoint, p256dh or auth in subscription.' },
      { status: 400 }
    );
  }

  try {
    // Upsert: if this exact endpoint already exists, update the keys.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId:   session.id,
        endpoint,
        p256dh:   keys.p256dh,
        auth:     keys.auth,
      },
      update: {
        userId:   session.id, // re-bind to current user in case of re-login
        p256dh:   keys.p256dh,
        auth:     keys.auth,
      },
    });

    return NextResponse.json({ success: true, message: 'Subscription registered.' });
  } catch (error: any) {
    console.error('[push/subscribe POST] error:', error?.message);
    return NextResponse.json(
      { success: false, error: 'Failed to save subscription.' },
      { status: 500 }
    );
  }
}

// ── DELETE /api/push/subscribe ────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body?.endpoint) {
    return NextResponse.json({ success: false, error: 'Missing endpoint.' }, { status: 400 });
  }

  try {
    // Delete only if the subscription belongs to the authenticated user.
    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: body.endpoint,
        userId:   session.id, // prevents cross-user deletion
      },
    });

    return NextResponse.json({ success: true, message: 'Subscription removed.' });
  } catch (error: any) {
    console.error('[push/subscribe DELETE] error:', error?.message);
    return NextResponse.json(
      { success: false, error: 'Failed to remove subscription.' },
      { status: 500 }
    );
  }
}

// ── GET /api/push/subscribe — check if current device has an active subscription ─
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ subscribed: false }, { status: 401 });
  }

  const endpoint = req.nextUrl.searchParams.get('endpoint');
  if (!endpoint) {
    // Return count of all subscriptions for this user.
    const count = await prisma.pushSubscription.count({ where: { userId: session.id } });
    return NextResponse.json({ subscribed: count > 0, count });
  }

  const sub = await prisma.pushSubscription.findFirst({
    where: { endpoint, userId: session.id },
    select: { id: true },
  });

  return NextResponse.json({ subscribed: Boolean(sub) });
}
