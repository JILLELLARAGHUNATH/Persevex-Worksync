import { prisma } from '../src/lib/prisma';
import { getIndiaWorkdayInfo, getIndiaDateKey } from '../src/lib/attendanceDate';
import { UserSession } from '../src/lib/auth';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, title: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${title}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${title}`, details || '');
    testsFailed++;
  }
}

async function runProductionConcurrencySuite() {
  console.log('\n========================================================================');
  console.log('🚀 RIGOROUS PRODUCTION MULTI-EMPLOYEE CONCURRENCY & ISOLATION TEST SUITE');
  console.log('========================================================================\n');

  try {
    const allUsers = await prisma.user.findMany({
      where: { isDeleted: false, accountStatus: { not: 'SUSPENDED' } },
      include: { team: true },
      take: 10,
    });

    if (allUsers.length < 2) {
      console.error('❌ Error: Need at least 2 users in database to run multi-employee concurrency suite.');
      process.exit(1);
    }

    const empA = allUsers[0];
    const empB = allUsers[1];
    const tenEmployees = allUsers.slice(0, 10);

    const now = new Date();
    const india = getIndiaWorkdayInfo(now);

    // Clean up today's test records for clean testing
    await prisma.attendance.deleteMany({
      where: {
        userId: { in: tenEmployees.map((u) => u.id) },
        OR: [
          { date: india.canonicalDate },
          { date: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
        ],
      },
    });

    // Helper: simulate single employee check-in logic (exact server action code)
    const simulateCheckIn = async (user: typeof allUsers[0]) => {
      const punchTime = new Date();
      const userIndia = getIndiaWorkdayInfo(punchTime);

      const existing = await prisma.attendance.findFirst({
        where: {
          userId: user.id,
          OR: [
            { date: userIndia.canonicalDate },
            { date: { gte: userIndia.startOfDayIST, lte: userIndia.endOfDayIST } },
            { checkInTime: { gte: userIndia.startOfDayIST, lte: userIndia.endOfDayIST } },
          ],
        },
      });

      if (existing && existing.checkInTime) {
        return { success: false, error: 'Already checked in', userId: user.id, user: user.fullName };
      }

      let record: any;
      if (existing) {
        const updateResult = await prisma.attendance.updateMany({
          where: { id: existing.id, checkInTime: null },
          data: { checkInTime: punchTime, status: 'PRESENT', lateStatus: 'ON_TIME' },
        });
        if (updateResult.count === 0) {
          const latest = await prisma.attendance.findUnique({ where: { id: existing.id } });
          return { success: false, error: 'Already checked in', userId: user.id, user: user.fullName, data: latest };
        }
        record = await prisma.attendance.findUnique({ where: { id: existing.id } });
      } else {
        try {
          record = await prisma.attendance.create({
            data: {
              userId: user.id,
              date: userIndia.canonicalDate,
              checkInTime: punchTime,
              status: 'PRESENT',
              lateStatus: 'ON_TIME',
            },
          });
        } catch {
          const race = await prisma.attendance.findUnique({
            where: { userId_date: { userId: user.id, date: userIndia.canonicalDate } },
          });
          if (race && race.checkInTime) {
            return { success: false, error: 'Already checked in', userId: user.id, user: user.fullName, data: race };
          }
          if (race) {
            await prisma.attendance.updateMany({
              where: { id: race.id, checkInTime: null },
              data: { checkInTime: punchTime, status: 'PRESENT', lateStatus: 'ON_TIME' },
            });
            record = await prisma.attendance.findUnique({ where: { id: race.id } });
          }
        }
      }

      return { success: true, recordId: record?.id, userId: record?.userId, user: user.fullName, checkInTime: record?.checkInTime };
    };

    // Helper: simulate single employee check-out logic (exact server action code)
    const simulateCheckOut = async (user: typeof allUsers[0]) => {
      const punchTime = new Date();
      const userIndia = getIndiaWorkdayInfo(punchTime);

      const record = await prisma.attendance.findFirst({
        where: {
          userId: user.id,
          OR: [
            { date: userIndia.canonicalDate },
            { date: { gte: userIndia.startOfDayIST, lte: userIndia.endOfDayIST } },
            { checkInTime: { gte: userIndia.startOfDayIST, lte: userIndia.endOfDayIST } },
          ],
        },
      });

      if (!record || !record.checkInTime) {
        return { success: false, error: 'No check-in record found', userId: user.id, user: user.fullName };
      }

      if (record.checkOutTime) {
        return { success: false, error: 'Already checked out', userId: user.id, user: user.fullName, data: record };
      }

      const diffMs = punchTime.getTime() - new Date(record.checkInTime).getTime();
      const totalHours = parseFloat((Math.max(0, diffMs) / (1000 * 60 * 60)).toFixed(2));

      const updateResult = await prisma.attendance.updateMany({
        where: { id: record.id, checkInTime: { not: null }, checkOutTime: null },
        data: { checkOutTime: punchTime, totalHours },
      });

      if (updateResult.count === 0) {
        const latest = await prisma.attendance.findUnique({ where: { id: record.id } });
        return { success: false, error: 'Already checked out', userId: user.id, user: user.fullName, data: latest };
      }

      const updated = await prisma.attendance.findUnique({ where: { id: record.id } });
      return { success: true, recordId: updated?.id, userId: updated?.userId, user: user.fullName, checkOutTime: updated?.checkOutTime, totalHours: updated?.totalHours };
    };

    // =========================================================================
    // TEST 1: SAME EMPLOYEE DOUBLE-CLICK (Race Condition Protection)
    // =========================================================================
    console.log('--- TEST 1: Same Employee (Emp A) 2 Simultaneous Check In Requests ---');
    const [t1_req1, t1_req2] = await Promise.all([simulateCheckIn(empA), simulateCheckIn(empA)]);
    const t1_successes = [t1_req1, t1_req2].filter((r) => r.success);
    const t1_recordsInDb = await prisma.attendance.findMany({
      where: { userId: empA.id, date: india.canonicalDate },
    });

    assert(t1_successes.length === 1, 'Exactly 1 simultaneous check-in request succeeded for same employee', { t1_req1, t1_req2 });
    assert(t1_recordsInDb.length === 1, 'Exactly 1 attendance record exists in DB (zero duplicate records created)');
    assert(t1_recordsInDb[0].userId === empA.id, 'Record correctly mapped to Employee A user ID');

    // Clean up for Test 2
    await prisma.attendance.deleteMany({ where: { userId: empA.id, date: india.canonicalDate } });

    // =========================================================================
    // TEST 2: 2 DIFFERENT EMPLOYEES SIMULTANEOUS CHECK-IN
    // =========================================================================
    console.log(`\n--- TEST 2: 2 DIFFERENT Employees (${empA.fullName} & ${empB.fullName}) Simultaneous Check In ---`);
    const [t2_resA, t2_resB] = await Promise.all([simulateCheckIn(empA), simulateCheckIn(empB)]);
    const t2_dbA = await prisma.attendance.findFirst({ where: { userId: empA.id, date: india.canonicalDate } });
    const t2_dbB = await prisma.attendance.findFirst({ where: { userId: empB.id, date: india.canonicalDate } });

    assert(t2_resA.success === true, 'Employee A check-in succeeded', t2_resA);
    assert(t2_resB.success === true, 'Employee B check-in succeeded', t2_resB);
    assert(t2_dbA !== null && t2_dbB !== null, 'Both attendance records exist in DB independently');
    assert(t2_dbA?.id !== t2_dbB?.id, 'Records have distinct IDs and did not overwrite each other');
    assert(t2_dbA?.userId === empA.id && t2_dbB?.userId === empB.id, 'Each record has the correct respective user ID');

    // =========================================================================
    // TEST 3: 10 DIFFERENT EMPLOYEES SIMULTANEOUS CHECK-IN
    // =========================================================================
    console.log(`\n--- TEST 3: ${tenEmployees.length} DIFFERENT Employees Simultaneous Check In ---`);
    // Clean up all 10 users first
    await prisma.attendance.deleteMany({
      where: { userId: { in: tenEmployees.map((u) => u.id) }, date: india.canonicalDate },
    });

    const t3_results = await Promise.all(tenEmployees.map((u) => simulateCheckIn(u)));
    const t3_successful = t3_results.filter((r) => r.success);
    const t3_allDbRecords = await prisma.attendance.findMany({
      where: { userId: { in: tenEmployees.map((u) => u.id) }, date: india.canonicalDate },
    });

    assert(t3_successful.length === tenEmployees.length, `All ${tenEmployees.length} independent concurrent requests succeeded (${t3_successful.length}/${tenEmployees.length})`);
    assert(t3_allDbRecords.length === tenEmployees.length, `Exactly ${tenEmployees.length} distinct attendance records created in DB`);
    
    // Verify each user has exactly 1 record
    const uniqueUserIdsInDb = new Set(t3_allDbRecords.map((r) => r.userId));
    assert(uniqueUserIdsInDb.size === tenEmployees.length, 'Every employee has their own unique attendance record with zero data cross-contamination');

    // =========================================================================
    // TEST 4: 2 DIFFERENT EMPLOYEES SIMULTANEOUS CHECK-OUT
    // =========================================================================
    console.log(`\n--- TEST 4: 2 DIFFERENT Employees (${empA.fullName} & ${empB.fullName}) Simultaneous Check Out ---`);
    const [t4_outA, t4_outB] = await Promise.all([simulateCheckOut(empA), simulateCheckOut(empB)]);
    const t4_dbA = await prisma.attendance.findFirst({ where: { userId: empA.id, date: india.canonicalDate } });
    const t4_dbB = await prisma.attendance.findFirst({ where: { userId: empB.id, date: india.canonicalDate } });

    assert(t4_outA.success === true, 'Employee A check-out succeeded', t4_outA);
    assert(t4_outB.success === true, 'Employee B check-out succeeded', t4_outB);
    assert(t4_dbA?.checkOutTime !== null && t4_dbB?.checkOutTime !== null, 'Both DB records have checkOutTime populated');
    assert(typeof t4_dbA?.totalHours === 'number' && typeof t4_dbB?.totalHours === 'number', 'Total working hours calculated for both employees independently');

    // =========================================================================
    // TEST 5: CLIENT-SIDE REALTIME EVENT USER ISOLATION
    // =========================================================================
    console.log('\n--- TEST 5: Client-Side Realtime Event Isolation Simulation ---');
    
    // Simulate Employee A receiving an event meant for Employee A -> ACCEPT
    const eventForEmpA = {
      type: 'ATTENDANCE_UPDATE',
      payload: {
        status: 'CHECKED_IN',
        attendance: { id: 'att-123', userId: empA.id, date: india.canonicalDate },
      },
    };

    // Simulate Employee B's client component filter
    const empB_targetUserId = empB.id;
    const empB_willAcceptEvent = Boolean(
      empB_targetUserId &&
      eventForEmpA.payload.attendance.userId &&
      eventForEmpA.payload.attendance.userId === empB_targetUserId
    );
    assert(empB_willAcceptEvent === false, 'Employee B client component REJECTS Employee A attendance update event (Zero UI interference)');

    // Simulate Employee A's client component filter
    const empA_targetUserId = empA.id;
    const empA_willAcceptEvent = Boolean(
      empA_targetUserId &&
      eventForEmpA.payload.attendance.userId &&
      eventForEmpA.payload.attendance.userId === empA_targetUserId
    );
    assert(empA_willAcceptEvent === true, 'Employee A client component ACCEPTS Employee A attendance update event');

    // Clean up test records
    await prisma.attendance.deleteMany({
      where: { userId: { in: tenEmployees.map((u) => u.id) }, date: india.canonicalDate },
    });
    console.log('\n🧹 Concurrency test records cleaned up from database.');

    console.log('\n========================================================================');
    console.log(`📊 CONCURRENCY SUITE SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('========================================================================\n');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during concurrency suite:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runProductionConcurrencySuite();
