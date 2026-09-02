import { prisma } from '../src/lib/prisma';
import { getIndiaWorkdayInfo } from '../src/lib/attendanceDate';
import { signSessionToken, UserSession } from '../src/lib/auth';

async function testConcurrentEmployees() {
  console.log('\n======================================================');
  console.log('🧪 CONCURRENCY TEST: MULTI-EMPLOYEE SIMULTANEOUS PUNCH');
  console.log('======================================================\n');

  try {
    // 1. Fetch active employee users from the database
    const users = await prisma.user.findMany({
      where: { isDeleted: false, accountStatus: { not: 'SUSPENDED' } },
      take: 10,
    });

    if (users.length < 2) {
      console.log('⚠️ Need at least 2 active users to run concurrency test.');
      return;
    }

    console.log(`Found ${users.length} active users for testing:`);
    users.forEach((u, i) => console.log(`  [${i + 1}] ${u.fullName} (${u.email}) - ID: ${u.id}`));

    const userA = users[0];
    const userB = users[1];

    const now = new Date();
    const india = getIndiaWorkdayInfo(now);

    // Clean up any test attendance records for today for userA and userB so we start fresh
    console.log(`\n🧹 Cleaning today's attendance records for ${userA.fullName} & ${userB.fullName}...`);
    await prisma.attendance.deleteMany({
      where: {
        userId: { in: [userA.id, userB.id] },
        OR: [
          { date: india.canonicalDate },
          { date: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
        ],
      },
    });

    console.log('\n--- SCENARIO 1: Two DIFFERENT employees check in at the EXACT same millisecond ---');

    // Simulate simultaneous checkIn operations using Promise.all
    const runCheckIn = async (user: typeof users[0]) => {
      const session: UserSession = {
        id: user.id,
        employeeId: user.employeeId,
        email: user.email,
        fullName: user.fullName,
        role: user.role as any,
        teamId: user.teamId,
      };

      // Perform checkIn logic as in attendanceActions.ts
      const checkInNow = new Date();
      const userIndia = getIndiaWorkdayInfo(checkInNow);

      const existing = await prisma.attendance.findFirst({
        where: {
          userId: session.id,
          OR: [
            { date: userIndia.canonicalDate },
            { date: { gte: userIndia.startOfDayIST, lte: userIndia.endOfDayIST } },
            { checkInTime: { gte: userIndia.startOfDayIST, lte: userIndia.endOfDayIST } },
          ],
        },
      });

      if (existing && existing.checkInTime) {
        return { success: false, user: user.fullName, error: 'Already checked in' };
      }

      let record: any;
      if (existing) {
        await prisma.attendance.updateMany({
          where: { id: existing.id, checkInTime: null },
          data: { checkInTime: checkInNow, status: 'PRESENT', lateStatus: 'ON_TIME' },
        });
        record = await prisma.attendance.findUnique({ where: { id: existing.id } });
      } else {
        try {
          record = await prisma.attendance.create({
            data: {
              userId: session.id,
              date: userIndia.canonicalDate,
              checkInTime: checkInNow,
              status: 'PRESENT',
              lateStatus: 'ON_TIME',
            },
          });
        } catch (e: any) {
          return { success: false, user: user.fullName, error: e.message };
        }
      }

      return { success: true, user: user.fullName, recordId: record?.id, userId: record?.userId };
    };

    const [resA, resB] = await Promise.all([runCheckIn(userA), runCheckIn(userB)]);

    console.log('Result Employee A:', resA);
    console.log('Result Employee B:', resB);

    if (resA.success && resB.success && resA.userId === userA.id && resB.userId === userB.id && resA.recordId !== resB.recordId) {
      console.log('  ✅ PASS: Both Employee A and Employee B checked in successfully with distinct records!');
    } else {
      console.error('  ❌ FAIL: One or both employees failed or interfered!');
    }

    // --- SCENARIO 2: 10 DIFFERENT employees check in simultaneously ---
    console.log(`\n--- SCENARIO 2: ${users.length} DIFFERENT employees check in simultaneously ---`);
    await prisma.attendance.deleteMany({
      where: {
        userId: { in: users.map((u) => u.id) },
        OR: [
          { date: india.canonicalDate },
          { date: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
        ],
      },
    });

    const results10 = await Promise.all(users.map((u) => runCheckIn(u)));
    const successful10 = results10.filter((r) => r.success);
    console.log(`10-User Concurrent Punch Results: ${successful10.length}/${users.length} succeeded.`);
    results10.forEach((r, i) => console.log(`  [${i + 1}] ${r.user}: ${r.success ? 'SUCCESS (Record: ' + r.recordId + ')' : 'FAILED: ' + r.error}`));

    if (successful10.length === users.length) {
      console.log(`  ✅ PASS: All ${users.length} distinct employees checked in concurrently with zero failures!`);
    } else {
      console.error('  ❌ FAIL: Some employees failed concurrent check-in!');
    }

    // --- SCENARIO 3: Same employee double-click simulation ---
    console.log(`\n--- SCENARIO 3: Same employee (${userA.fullName}) double-clicks simultaneously ---`);
    const doublePunchResults = await Promise.all([runCheckIn(userA), runCheckIn(userA)]);
    console.log('Double punch results:', doublePunchResults);
    const doubleSuccess = doublePunchResults.filter((r) => r.success);
    console.log(`Double punch successes: ${doubleSuccess.length} (Expected: 1 or idempotent protection)`);

    // Clean up test records
    await prisma.attendance.deleteMany({
      where: {
        userId: { in: users.map((u) => u.id) },
        OR: [
          { date: india.canonicalDate },
          { date: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
        ],
      },
    });
    console.log('\n🧹 Test records cleaned up.');

  } catch (error) {
    console.error('Error in concurrency test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConcurrentEmployees();
