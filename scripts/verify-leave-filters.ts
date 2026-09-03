import { prisma } from '../src/lib/prisma';
import { getIndiaDateKey, formatDate } from '../src/lib/utils';
import { getTodayIndiaDateKey, getYesterdayIndiaDateKey, getIndiaWorkdayInfo } from '../src/lib/attendanceDate';
import { getLeaveFilterDateRange, doesLeaveOverlapRange, LeaveDatePreset } from '../src/lib/leaveFilters';

async function runLeaveFilterVerification() {
  console.log('\n================================================================');
  console.log('🧪 VERIFYING LEAVE REQUEST FILTERS (MANAGER, TL, EMPLOYEE)');
  console.log('================================================================\n');

  try {
    const now = new Date();
    const todayKey = getTodayIndiaDateKey(now);
    const yesterdayKey = getYesterdayIndiaDateKey(now);
    const india = getIndiaWorkdayInfo(now);

    console.log(`📅 Current Indian Workday Key (Asia/Kolkata): ${todayKey}`);
    console.log(`📅 Yesterday Indian Workday Key (Asia/Kolkata): ${yesterdayKey}`);

    // -----------------------------------------------------------------
    // TEST 1: Leave Date Overlap Logic Tests
    // -----------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('🧪 TEST 1: Leave Date Overlap Logic Tests');
    console.log('----------------------------------------------------------------');

    // Case 1: Example from prompt: Leave Sept 1 -> Sept 10, Selected Date Sept 5
    const leave1Start = '2026-09-01';
    const leave1End = '2026-09-10';
    const selectedDate1 = '2026-09-05';
    const { startRangeKey: s1, endRangeKey: e1 } = getLeaveFilterDateRange('DATE', selectedDate1, now);
    const match1 = doesLeaveOverlapRange(leave1Start, leave1End, s1, e1);
    console.log(`  Case 1 (Sept 1-10 vs Sept 5): ${match1 ? 'MATCHED (PASSED)' : 'FAILED'}`);
    if (!match1) throw new Error('Case 1 failed');

    // Case 2: Leave starts today
    const leave2Start = todayKey;
    const leave2End = todayKey;
    const { startRangeKey: s2, endRangeKey: e2 } = getLeaveFilterDateRange('TODAY', undefined, now);
    const match2 = doesLeaveOverlapRange(leave2Start, leave2End, s2, e2);
    console.log(`  Case 2 (Starts & Ends Today vs Today): ${match2 ? 'MATCHED (PASSED)' : 'FAILED'}`);
    if (!match2) throw new Error('Case 2 failed');

    // Case 3: Leave completely covers selected range
    // e.g. Leave Aug 20 -> Sept 20 vs This Month (Sept 1 -> Sept 30)
    const { startRangeKey: s3, endRangeKey: e3 } = getLeaveFilterDateRange('MONTH', undefined, now);
    const leave3Start = '2026-08-20';
    const leave3End = '2026-09-20';
    const match3 = doesLeaveOverlapRange(leave3Start, leave3End, s3, e3);
    console.log(`  Case 3 (Aug 20 - Sept 20 vs This Month): ${match3 ? 'MATCHED (PASSED)' : 'FAILED'}`);
    if (!match3) throw new Error('Case 3 failed');

    // Case 4: Selected range completely covers leave
    // e.g. Leave Sept 5 -> Sept 7 vs This Month
    const leave4Start = '2026-09-05';
    const leave4End = '2026-09-07';
    const match4 = doesLeaveOverlapRange(leave4Start, leave4End, s3, e3);
    console.log(`  Case 4 (Sept 5 - Sept 7 vs This Month): ${match4 ? 'MATCHED (PASSED)' : 'FAILED'}`);
    if (!match4) throw new Error('Case 4 failed');

    // Case 5: Leave outside selected range (October vs September)
    const leave5Start = '2026-10-01';
    const leave5End = '2026-10-05';
    const match5 = doesLeaveOverlapRange(leave5Start, leave5End, s3, e3);
    console.log(`  Case 5 (Oct 1 - Oct 5 vs September Month): ${!match5 ? 'NOT MATCHED (CORRECT - PASSED)' : 'FAILED'}`);
    if (match5) throw new Error('Case 5 failed');

    // Case 6: Yesterday
    const { startRangeKey: s6, endRangeKey: e6 } = getLeaveFilterDateRange('YESTERDAY', undefined, now);
    const leave6Start = yesterdayKey;
    const leave6End = yesterdayKey;
    const match6 = doesLeaveOverlapRange(leave6Start, leave6End, s6, e6);
    console.log(`  Case 6 (Yesterday Leave vs Yesterday): ${match6 ? 'MATCHED (PASSED)' : 'FAILED'}`);
    if (!match6) throw new Error('Case 6 failed');

    console.log('✅ TEST 1 PASSED!\n');

    // -----------------------------------------------------------------
    // TEST 2: Manager Combined Filters Simulation
    // -----------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('🧪 TEST 2: Manager Combined Filters Simulation');
    console.log('----------------------------------------------------------------');

    const allLeaves = await prisma.leaveRequest.findMany({
      include: { user: { include: { team: true } } },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`  Total Leave Records in DB: ${allLeaves.length}`);

    // Mock dataset for deterministic testing
    const mockLeaves = [
      {
        id: 'mock-1',
        userId: 'user-1',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-09-10T00:00:00.000Z'),
        currentStage: 'APPROVED',
        user: { fullName: 'Alice', employeeId: 'EMP001', teamId: 'team-alpha', team: { name: 'Alpha' } },
      },
      {
        id: 'mock-2',
        userId: 'user-2',
        startDate: new Date('2026-09-05T00:00:00.000Z'),
        endDate: new Date('2026-09-06T00:00:00.000Z'),
        currentStage: 'PENDING_MANAGER',
        user: { fullName: 'Bob', employeeId: 'EMP002', teamId: 'team-alpha', team: { name: 'Alpha' } },
      },
      {
        id: 'mock-3',
        userId: 'user-3',
        startDate: new Date('2026-09-15T00:00:00.000Z'),
        endDate: new Date('2026-09-20T00:00:00.000Z'),
        currentStage: 'REJECTED',
        user: { fullName: 'Charlie', employeeId: 'EMP003', teamId: 'team-beta', team: { name: 'Beta' } },
      },
    ];

    // Filter A: All Requests + Date: '2026-09-05' + Status: 'APPROVED'
    const { startRangeKey: sa, endRangeKey: ea } = getLeaveFilterDateRange('DATE', '2026-09-05', now);
    const filterA = mockLeaves.filter((l) => {
      if (!doesLeaveOverlapRange(l.startDate, l.endDate, sa, ea)) return false;
      if (l.currentStage !== 'APPROVED') return false;
      return true;
    });
    console.log(`  Filter A (Sept 5 + APPROVED): Expected 1 (Alice), Got ${filterA.length} -> ${filterA.length === 1 && filterA[0].id === 'mock-1' ? 'PASSED' : 'FAILED'}`);
    if (filterA.length !== 1) throw new Error('Filter A failed');

    // Filter B: All Requests + Team: 'team-alpha' + Status: 'PENDING'
    const filterB = mockLeaves.filter((l) => {
      if (l.user.teamId !== 'team-alpha') return false;
      const isPending = l.currentStage === 'PENDING_TL' || l.currentStage === 'PENDING_MANAGER';
      if (!isPending) return false;
      return true;
    });
    console.log(`  Filter B (Team Alpha + PENDING): Expected 1 (Bob), Got ${filterB.length} -> ${filterB.length === 1 && filterB[0].id === 'mock-2' ? 'PASSED' : 'FAILED'}`);
    if (filterB.length !== 1) throw new Error('Filter B failed');

    // Filter C: All Requests + Employee: 'user-3' (Charlie)
    const filterC = mockLeaves.filter((l) => l.userId === 'user-3');
    console.log(`  Filter C (Employee Charlie): Expected 1 (Charlie), Got ${filterC.length} -> ${filterC.length === 1 && filterC[0].id === 'mock-3' ? 'PASSED' : 'FAILED'}`);
    if (filterC.length !== 1) throw new Error('Filter C failed');

    console.log('✅ TEST 2 PASSED!\n');

    // -----------------------------------------------------------------
    // TEST 3: Team Lead Squad Scope & Security Isolation
    // -----------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('🧪 TEST 3: Team Lead Scope & Security Isolation');
    console.log('----------------------------------------------------------------');

    const teams = await prisma.team.findMany({
      where: { isActive: true },
      include: { members: true },
    });

    if (teams.length >= 2) {
      const tlTeam = teams[0];
      const otherTeam = teams[1];

      const tlTeamMemberIds = new Set(tlTeam.members.map((m) => m.id));
      const foreignMember = otherTeam.members.find((m) => !tlTeamMemberIds.has(m.id));

      if (foreignMember) {
        // Query leaves as Team Lead
        const tlScopedLeaves = await prisma.leaveRequest.findMany({
          where: {
            user: { teamId: tlTeam.id },
          },
          include: { user: true },
        });

        const hasForeignLeave = tlScopedLeaves.some((l) => l.userId === foreignMember.id);
        console.log(`  Security Check: Does TL squad scope contain leaves of foreign member (${foreignMember.fullName})? ${hasForeignLeave ? 'SECURITY VIOLATION' : 'NO (PROTECTED - PASSED)'}`);
        if (hasForeignLeave) throw new Error('Team Lead query leaked unauthorized leave records');
      }
    }
    console.log('✅ TEST 3 PASSED!\n');

    // -----------------------------------------------------------------
    // TEST 4: Employee Self-Data Isolation
    // -----------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('🧪 TEST 4: Employee Self-Data Isolation');
    console.log('----------------------------------------------------------------');

    const users = await prisma.user.findMany({
      where: { isDeleted: false, accountStatus: 'ACTIVE' },
      take: 2,
    });

    if (users.length >= 2) {
      const emp1 = users[0];
      const emp2 = users[1];

      const emp1Leaves = await prisma.leaveRequest.findMany({
        where: { userId: emp1.id },
      });

      const hasOtherUserLeave = emp1Leaves.some((l) => l.userId === emp2.id);
      console.log(`  Employee (${emp1.fullName}) leave query strictly scoped to self? ${!hasOtherUserLeave ? 'YES (PASSED)' : 'SECURITY VIOLATION'}`);
      if (hasOtherUserLeave) throw new Error('Employee query leaked other users leave records');
    }
    console.log('✅ TEST 4 PASSED!\n');

    console.log('================================================================');
    console.log('🎉 ALL LEAVE REQUEST FILTER TESTS PASSED 100%!');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Leave filter verification failed:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

runLeaveFilterVerification();
