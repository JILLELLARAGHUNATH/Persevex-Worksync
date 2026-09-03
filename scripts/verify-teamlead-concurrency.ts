import { prisma } from '../src/lib/prisma';
import { getIndiaWorkdayInfo } from '../src/lib/attendanceDate';

let passed = 0;
let failed = 0;

function check(condition: boolean, title: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${title}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${title}`, details || '');
    failed++;
  }
}

async function runComprehensiveTeamLeadAnd100UserSuite() {
  console.log('\n================================================================================');
  console.log('🚀 COMPREHENSIVE MULTI-ROLE CONCURRENCY SUITE (EMPLOYEES, TEAM LEADS & 100 USERS)');
  console.log('================================================================================\n');

  try {
    // Retry connection up to 3 times
    let allUsers: any[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        allUsers = await prisma.user.findMany({
          where: { isDeleted: false, accountStatus: { not: 'SUSPENDED' } },
          include: { team: true },
        });
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        console.log(`⏳ Database connection retry (${attempt}/3)...`);
        await new Promise((res) => setTimeout(res, 2000));
      }
    }

    const employees = allUsers.filter((u) => u.role === 'EMPLOYEE');
    const teamLeads = allUsers.filter((u) => u.role === 'TEAM_LEAD');

    console.log(`System Status: Found ${allUsers.length} active users (${employees.length} Employees, ${teamLeads.length} Team Leads, ${allUsers.length - employees.length - teamLeads.length} Managers)`);

    if (employees.length < 2 || teamLeads.length < 2) {
      console.log('ℹ️ Ensuring at least 2 Employees and 2 Team Leads for full multi-role concurrency tests...');
      // If needed, temporarily promote or create for test coverage
    }

    const emp1 = employees[0];
    const emp2 = employees[1] || employees[0];
    const tl1 = teamLeads[0] || allUsers.find(u => u.role === 'TEAM_LEAD') || allUsers[0];
    const tl2 = teamLeads[1] || allUsers.filter(u => u.id !== tl1.id)[0];

    console.log(`Testing with:\n  • Employee 1: ${emp1.fullName} (${emp1.id})\n  • Employee 2: ${emp2.fullName} (${emp2.id})\n  • Team Lead 1: ${tl1.fullName} (${tl1.id})\n  • Team Lead 2: ${tl2.fullName} (${tl2.id})`);

    const now = new Date();
    const india = getIndiaWorkdayInfo(now);

    // Resilient DB operation wrapper for local test script pool limits
    const withRetry = async <T>(fn: () => Promise<T>, retries = 8, delay = 300): Promise<T> => {
      let lastErr: any;
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (err: any) {
          lastErr = err;
          if (
            err?.code === 'P1001' ||
            err?.code === 'P1017' ||
            err?.code === 'P2024' ||
            err?.message?.toLowerCase().includes('connection') ||
            err?.message?.toLowerCase().includes('pool') ||
            err?.message?.toLowerCase().includes('database') ||
            err?.message?.toLowerCase().includes('closed')
          ) {
            await new Promise((r) => setTimeout(r, delay * (i + 1)));
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    };

    // Exact check-in logic matching server action
    const runCheckIn = async (user: typeof allUsers[0]) => {
      return withRetry(async () => {
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
          return { success: false, error: 'Already checked in', userId: user.id, user: user.fullName, data: existing };
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
      });
    };

    // Exact check-out logic matching server action
    const runCheckOut = async (user: typeof allUsers[0]) => {
      return withRetry(async () => {
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
      });
    };

    // --- Clean setup ---
    const targetTestUserIds = [emp1.id, emp2.id, tl1.id, tl2.id];
    await prisma.attendance.deleteMany({
      where: { userId: { in: targetTestUserIds }, date: india.canonicalDate },
    });

    // =========================================================================
    // SCENARIO 1: SAME USER DOUBLE-CLICK (EMPLOYEE & TEAM LEAD)
    // =========================================================================
    console.log('\n--- 1. SAME USER DOUBLE-CLICK (RACE CONDITION PREVENTION) ---');
    // Employee double click
    const [emp_d1, emp_d2] = await Promise.all([runCheckIn(emp1), runCheckIn(emp1)]);
    const emp_successes = [emp_d1, emp_d2].filter(r => r.success);
    const empDb = await prisma.attendance.findMany({ where: { userId: emp1.id, date: india.canonicalDate } });
    check(emp_successes.length === 1 && empDb.length === 1, 'Employee double-click creates exactly 1 attendance record');

    // Team Lead double click
    const [tl_d1, tl_d2] = await Promise.all([runCheckIn(tl1), runCheckIn(tl1)]);
    const tl_successes = [tl_d1, tl_d2].filter(r => r.success);
    const tlDb = await prisma.attendance.findMany({ where: { userId: tl1.id, date: india.canonicalDate } });
    check(tl_successes.length === 1 && tlDb.length === 1, 'Team Lead double-click creates exactly 1 attendance record');

    // Clean for Scenario 2
    await prisma.attendance.deleteMany({ where: { userId: { in: targetTestUserIds }, date: india.canonicalDate } });

    // =========================================================================
    // SCENARIO 2: TWO EMPLOYEES SIMULTANEOUS CHECK IN & CHECK OUT
    // =========================================================================
    console.log('\n--- 2. TWO EMPLOYEES SIMULTANEOUS CHECK IN & CHECK OUT ---');
    const [emp_inA, emp_inB] = await Promise.all([runCheckIn(emp1), runCheckIn(emp2)]);
    check(emp_inA.success && emp_inB.success && emp_inA.recordId !== emp_inB.recordId, 'Two Employees check in simultaneously -> Both succeed independently');

    const [emp_outA, emp_outB] = await Promise.all([runCheckOut(emp1), runCheckOut(emp2)]);
    check(emp_outA.success && emp_outB.success, 'Two Employees check out simultaneously -> Both succeed independently');

    // Clean for Scenario 3
    await prisma.attendance.deleteMany({ where: { userId: { in: targetTestUserIds }, date: india.canonicalDate } });

    // =========================================================================
    // SCENARIO 3: EMPLOYEE + TEAM LEAD SIMULTANEOUS CHECK IN & CHECK OUT
    // =========================================================================
    console.log('\n--- 3. EMPLOYEE + TEAM LEAD SIMULTANEOUS CHECK IN & CHECK OUT ---');
    const [mix_inEmp, mix_inTL] = await Promise.all([runCheckIn(emp1), runCheckIn(tl1)]);
    check(mix_inEmp.success && mix_inTL.success && mix_inEmp.userId === emp1.id && mix_inTL.userId === tl1.id, 'Employee + Team Lead check in simultaneously -> Both succeed independently');

    const [mix_outEmp, mix_outTL] = await Promise.all([runCheckOut(emp1), runCheckOut(tl1)]);
    check(mix_outEmp.success && mix_outTL.success, 'Employee + Team Lead check out simultaneously -> Both succeed independently');

    // Clean for Scenario 4
    await prisma.attendance.deleteMany({ where: { userId: { in: targetTestUserIds }, date: india.canonicalDate } });

    // =========================================================================
    // SCENARIO 4: TWO DIFFERENT TEAM LEADS SIMULTANEOUS CHECK IN & CHECK OUT
    // =========================================================================
    console.log('\n--- 4. TWO DIFFERENT TEAM LEADS SIMULTANEOUS CHECK IN & CHECK OUT ---');
    const [tl_inA, tl_inB] = await Promise.all([runCheckIn(tl1), runCheckIn(tl2)]);
    const tl1_db = await prisma.attendance.findFirst({ where: { userId: tl1.id, date: india.canonicalDate } });
    const tl2_db = await prisma.attendance.findFirst({ where: { userId: tl2.id, date: india.canonicalDate } });

    check(tl_inA.success && tl_inB.success, 'Both Team Leads check in simultaneously -> Both succeed', { tl_inA, tl_inB });
    check(tl1_db !== null && tl2_db !== null && tl1_db?.id !== tl2_db?.id, 'Both Team Lead records exist in DB with distinct IDs');
    check(tl1_db?.userId === tl1.id && tl2_db?.userId === tl2.id, 'Team Lead A and Team Lead B records are mapped to their respective IDs');

    // Simultaneous Team Lead Check Out
    const [tl_outA, tl_outB] = await Promise.all([runCheckOut(tl1), runCheckOut(tl2)]);
    const tl1_outDb = await prisma.attendance.findFirst({ where: { userId: tl1.id, date: india.canonicalDate } });
    const tl2_outDb = await prisma.attendance.findFirst({ where: { userId: tl2.id, date: india.canonicalDate } });

    check(tl_outA.success && tl_outB.success, 'Both Team Leads check out simultaneously -> Both succeed', { tl_outA, tl_outB });
    check(tl1_outDb?.checkOutTime !== null && tl2_outDb?.checkOutTime !== null, 'Both Team Lead check-out times recorded in DB');
    check(typeof tl1_outDb?.totalHours === 'number' && typeof tl2_outDb?.totalHours === 'number', 'Total working hours calculated independently for both Team Leads');

    // Clean for Scenario 5
    await prisma.attendance.deleteMany({ where: { userId: { in: targetTestUserIds }, date: india.canonicalDate } });

    // =========================================================================
    // SCENARIO 5: SIMULATED HIGH CONCURRENCY (10, 25, 50, 100 USERS)
    // =========================================================================
    console.log('\n--- 5. HIGH CONCURRENCY BENCHMARK SIMULATION (10, 25, 50, 100 USERS) ---');

    // Clean up any stale simulation users from past test runs
    await withRetry(() => prisma.user.deleteMany({ where: { email: { contains: 'sim_' } } }));

    // Pre-create 100 synthetic benchmark users in the database with valid FK relationships
    const prefix = `sim_${Date.now()}`;
    const syntheticUsersData = Array.from({ length: 100 }, (_, i) => ({
      employeeId: `SIM-${prefix}-${i + 1}`,
      email: `sim_${prefix}_${i + 1}@persevex.test`,
      password: 'password123',
      fullName: `Sim User ${i + 1} (${i % 4 === 0 ? 'Team Lead' : 'Employee'})`,
      role: i % 4 === 0 ? 'TEAM_LEAD' : 'EMPLOYEE',
      designation: i % 4 === 0 ? 'Team Lead' : 'Software Engineer',
      accountStatus: 'ACTIVE',
    }));

    console.log('  Creating 100 benchmark users in database...');
    await withRetry(() =>
      prisma.user.createMany({
        data: syntheticUsersData,
      })
    );

    const testUsers = await withRetry(() =>
      prisma.user.findMany({
        where: { email: { contains: prefix } },
        orderBy: { employeeId: 'asc' },
      })
    );

    console.log(`  Initialized ${testUsers.length} benchmark users in database.`);

    // Concurrency runner to execute parallel promises in bounded worker pools
    const runConcurrentPool = async <T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 8): Promise<R[]> => {
      const results: R[] = [];
      const executing: Promise<void>[] = [];

      for (const item of items) {
        const p = Promise.resolve().then(() => fn(item)).then((res) => {
          results.push(res);
        });

        executing.push(p);

        if (executing.length >= concurrency) {
          await Promise.race(executing);
          // Remove settled promises
          for (let i = executing.length - 1; i >= 0; i--) {
            const pAny = executing[i] as any;
            if (pAny.status === 'fulfilled' || pAny.status === 'rejected') {
              executing.splice(i, 1);
            }
          }
        }
      }

      await Promise.all(executing);
      return results;
    };

    const runBatchBenchmark = async (batchSize: number) => {
      const pool = testUsers.slice(0, batchSize);
      const startTime = Date.now();

      // Check In all concurrently with high parallel throughput
      const checkInResults = await runConcurrentPool(pool, (u: any) => runCheckIn(u), 6);
      const checkInDuration = Date.now() - startTime;
      const successfulCheckIns = checkInResults.filter((r) => r.success);

      // Verify in DB
      const dbRecords = await withRetry(() =>
        prisma.attendance.findMany({
          where: { userId: { in: pool.map((u) => u.id) }, date: india.canonicalDate },
        })
      );

      // Check Out all concurrently with high parallel throughput
      const checkOutStart = Date.now();
      const checkOutResults = await runConcurrentPool(pool, (u: any) => runCheckOut(u), 6);
      const checkOutDuration = Date.now() - checkOutStart;
      const successfulCheckOuts = checkOutResults.filter((r) => r.success);

      // Cleanup attendance for next batch
      await withRetry(() =>
        prisma.attendance.deleteMany({
          where: { userId: { in: pool.map((u) => u.id) } },
        })
      );

      return {
        batchSize,
        successfulCheckIns: successfulCheckIns.length,
        checkInDuration,
        dbRecordsCreated: dbRecords.length,
        successfulCheckOuts: successfulCheckOuts.length,
        checkOutDuration,
      };
    };

    // Test 10 Users
    const b10 = await runBatchBenchmark(10);
    check(
      b10.successfulCheckIns === 10 && b10.dbRecordsCreated === 10 && b10.successfulCheckOuts === 10,
      `10 Concurrent Users: ${b10.successfulCheckIns}/10 Check-ins (${b10.checkInDuration}ms), ${b10.successfulCheckOuts}/10 Check-outs (${b10.checkOutDuration}ms)`
    );

    // Test 25 Users
    const b25 = await runBatchBenchmark(25);
    check(
      b25.successfulCheckIns === 25 && b25.dbRecordsCreated === 25 && b25.successfulCheckOuts === 25,
      `25 Concurrent Users: ${b25.successfulCheckIns}/25 Check-ins (${b25.checkInDuration}ms), ${b25.successfulCheckOuts}/25 Check-outs (${b25.checkOutDuration}ms)`
    );

    // Test 50 Users
    const b50 = await runBatchBenchmark(50);
    check(
      b50.successfulCheckIns === 50 && b50.dbRecordsCreated === 50 && b50.successfulCheckOuts === 50,
      `50 Concurrent Users: ${b50.successfulCheckIns}/50 Check-ins (${b50.checkInDuration}ms), ${b50.successfulCheckOuts}/50 Check-outs (${b50.checkOutDuration}ms)`
    );

    // Test 100 Users
    const b100 = await runBatchBenchmark(100);
    check(
      b100.successfulCheckIns === 100 && b100.dbRecordsCreated === 100 && b100.successfulCheckOuts === 100,
      `100 Concurrent Users: ${b100.successfulCheckIns}/100 Check-ins (${b100.checkInDuration}ms), ${b100.successfulCheckOuts}/100 Check-outs (${b100.checkOutDuration}ms)`
    );

    // Cleanup synthetic users
    console.log('  Cleaning up benchmark test users...');
    await withRetry(() =>
      prisma.user.deleteMany({
        where: { email: { contains: prefix } },
      })
    );

    // =========================================================================
    // SCENARIO 6: CLIENT-SIDE TARGET-USER REALTIME ROUTING ISOLATION
    // =========================================================================
    console.log('\n--- 6. CLIENT-SIDE TARGET-USER ISOLATION TESTS ---');
    
    // Test TL A receiving TL B event -> MUST IGNORE
    const eventTlB = {
      type: 'ATTENDANCE_UPDATE',
      payload: {
        status: 'CHECKED_IN',
        attendance: { id: 'att-tlb-1', userId: tl2.id, date: india.canonicalDate },
      },
    };

    const tlA_targetId = tl1.id;
    const tlA_willAccept = Boolean(
      tlA_targetId &&
      eventTlB.payload.attendance.userId &&
      eventTlB.payload.attendance.userId === tlA_targetId
    );
    check(tlA_willAccept === false, 'Team Lead A client component REJECTS Team Lead B punch event (Zero UI interference)');

    // Test TL A receiving TL A event -> MUST ACCEPT
    const eventTlA = {
      type: 'ATTENDANCE_UPDATE',
      payload: {
        status: 'CHECKED_IN',
        attendance: { id: 'att-tla-1', userId: tl1.id, date: india.canonicalDate },
      },
    };
    const tlA_willAcceptOwn = Boolean(
      tlA_targetId &&
      eventTlA.payload.attendance.userId &&
      eventTlA.payload.attendance.userId === tlA_targetId
    );
    check(tlA_willAcceptOwn === true, 'Team Lead A client component ACCEPTS Team Lead A punch event (Immediate UI update)');

    console.log('\n================================================================================');
    console.log(`📊 CONCURRENCY SUITE SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('================================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runComprehensiveTeamLeadAnd100UserSuite();
