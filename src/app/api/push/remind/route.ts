/**
 * /api/push/remind  (GET | POST)
 *
 * Vercel Cron endpoint — triggered daily at 05:30 UTC (= 11:00 AM IST).
 * Sends one punch-in push notification per eligible device.
 *
 * Eligibility per employee:
 *  1. Role is EMPLOYEE or TEAM_LEAD (not MANAGER).
 *  2. Account is ACTIVE and not deleted.
 *  3. Today is a working day (not Wednesday weekly-off, not a company holiday).
 *  4. No APPROVED full-day leave covering today.
 *  5. Has NOT already punched in today (no Attendance.checkInTime for today).
 *  6. Has at least one registered PushSubscription.
 *
 * Duplicate prevention:
 *  - A PushReminderLog row is created for each (userId, dateKey, endpoint).
 *  - Unique constraint prevents re-insertion, so concurrent or retried executions
 *    safely skip already-sent reminders.
 *
 * Security:
 *  - Protected by CRON_SECRET (same pattern as the existing auto-checkout cron).
 *  - Unauthenticated callers receive 401.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/webpush';
import { getIndiaDateKey } from '@/lib/attendanceDate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NOTIFICATION_TITLE = 'WorkSync — Punch-In Reminder';
const NOTIFICATION_BODY  =
  "Good morning! Don't forget to punch in on WorkSync when you arrive at the office.";

// ── Auth helper (reuse same pattern as auto-checkout route) ───────────────────
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // Dev: no secret configured — allow freely.

  const authHeader   = req.headers.get('authorization');
  const queryKey     = req.nextUrl.searchParams.get('key') || req.nextUrl.searchParams.get('secret');
  const bearerValid  = authHeader === `Bearer ${cronSecret}`;
  const queryValid   = queryKey   === cronSecret;

  return bearerValid || queryValid;
}

// ── Workday eligibility check ─────────────────────────────────────────────────
async function isTodayEligibleWorkday(dateKey: string): Promise<boolean> {
  // Reconstruct day-of-week: parse the dateKey directly.
  const [y, m, d] = dateKey.split('-').map(Number);
  // JS Date constructed at noon UTC to avoid timezone boundary issues.
  const dateMidnight = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = dateMidnight.getUTCDay(); // 0=Sun, 3=Wed

  // Check if today has a calendar override
  const override = await prisma.companyCalendar.findFirst({
    where: { dateKey },
    select: { type: true },
  });

  if (override?.type === 'COMPANY_HOLIDAY') return false;
  if (override?.type === 'SPECIAL_WORKING_DAY') return true;

  // Wednesday is the weekly off (matches calendar.ts logic: dayOfWeek === 3).
  if (dow === 3) return false;

  return true;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Missing or invalid CRON_SECRET.' },
      { status: 401 }
    );
  }

  const now      = new Date();
  const dateKey  = getIndiaDateKey(now); // "YYYY-MM-DD" in IST

  // Step 1: Check if today is an eligible working day.
  const isWorkday = await isTodayEligibleWorkday(dateKey);
  if (!isWorkday) {
    return NextResponse.json({
      success: true,
      message: `Skipped — ${dateKey} is a weekly off or company holiday.`,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
  }

  // Step 2: Determine today's attendance window in UTC (IST = UTC+5:30).
  const [y, mo, dy] = dateKey.split('-').map(Number);
  const startOfDayUTC = new Date(Date.UTC(y, mo - 1, dy, -5, -30, 0, 0));   // 00:00 IST → prev UTC day 18:30Z
  const endOfDayUTC   = new Date(Date.UTC(y, mo - 1, dy, 18, 29, 59, 999)); // 23:59 IST

  // Step 3: Load all active EMPLOYEE / TEAM_LEAD users that have subscriptions.
  const eligibleUsers = await prisma.user.findMany({
    where: {
      role:          { in: ['EMPLOYEE', 'TEAM_LEAD'] },
      accountStatus: 'ACTIVE',
      isDeleted:     false,
      pushSubscriptions: { some: {} },
    },
    select: {
      id:   true,
      role: true,
      pushSubscriptions: {
        select: { endpoint: true, p256dh: true, auth: true },
      },
    },
  });

  let sent    = 0;
  let skipped = 0;
  let failed  = 0;

  for (const user of eligibleUsers) {
    // Step 4a: Check if already punched in today.
    const attendance = await prisma.attendance.findFirst({
      where: {
        userId:       user.id,
        date:         { gte: startOfDayUTC, lte: endOfDayUTC },
        checkInTime:  { not: null },
      },
      select: { id: true },
    });
    if (attendance) { skipped++; continue; }

    // Step 4b: Check for approved full-day leave covering today.
    const leave = await prisma.leaveRequest.findFirst({
      where: {
        userId:       user.id,
        currentStage: 'APPROVED',
        startDate:    { lte: endOfDayUTC },
        endDate:      { gte: startOfDayUTC },
        numberOfDays: { gte: 1 }, // full-day or multi-day leave
      },
      select: { id: true, numberOfDays: true },
    });
    if (leave) { skipped++; continue; }

    // Step 5: Send to each registered device.
    for (const sub of user.pushSubscriptions) {
      // Duplicate guard — skip if already logged for this (userId, dateKey, endpoint).
      try {
        await prisma.pushReminderLog.create({
          data: { userId: user.id, dateKey, endpoint: sub.endpoint },
        });
      } catch {
        // Unique constraint violation → already sent to this device today.
        skipped++;
        continue;
      }

      // Determine the dashboard URL per role.
      const dashboardUrl =
        user.role === 'TEAM_LEAD'
          ? '/team-lead'
          : '/employee';

      const result = await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title: NOTIFICATION_TITLE, body: NOTIFICATION_BODY, url: dashboardUrl }
      );

      if (result === 'sent') {
        sent++;
      } else if (result === 'gone') {
        // Subscription expired — clean it up so we don't retry next time.
        await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => {});
        skipped++;
      } else {
        failed++;
      }
    }
  }

  console.log(`[push/remind] ${dateKey}: sent=${sent} skipped=${skipped} failed=${failed}`);

  return NextResponse.json({
    success: true,
    message: `Punch-in reminders processed for ${dateKey}.`,
    dateKey,
    sent,
    skipped,
    failed,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
