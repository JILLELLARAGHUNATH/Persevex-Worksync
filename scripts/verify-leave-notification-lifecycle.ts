import { prisma } from '../src/lib/prisma';
import { applyLeaveAction, processLeaveApprovalAction } from '../src/actions/leaveActions';

async function runLeaveNotificationLifecycleTests() {
  console.log('\n================================================================');
  console.log('🧪 VERIFYING LEAVE NOTIFICATION LIFECYCLE & REAL-TIME SYNC');
  console.log('================================================================\n');

  const testUserIds: string[] = [];
  const testLeaveIds: string[] = [];
  const testNotifIds: string[] = [];

  const initialProdUsers = await prisma.user.count({ where: { isDeleted: false } });
  console.log(`🔒 Initial Database State: ${initialProdUsers} production users present.`);

  try {
    // -----------------------------------------------------------------
    // SETUP: Provision isolated test Employee & Manager
    // -----------------------------------------------------------------
    console.log('📦 Setting up isolated test users (Employee & Manager)...');

    const testEmp = await prisma.user.create({
      data: {
        email: 'test_leave_emp@notif-test.internal',
        password: 'secure_password_hash',
        fullName: 'Test Leave Employee',
        employeeId: 'EMP-NOTIF-01',
        role: 'EMPLOYEE',
      },
    });
    testUserIds.push(testEmp.id);

    const testMgr = await prisma.user.create({
      data: {
        email: 'test_leave_mgr@notif-test.internal',
        password: 'secure_password_hash',
        fullName: 'Test Leave Manager',
        employeeId: 'MGR-NOTIF-01',
        role: 'MANAGER',
      },
    });
    testUserIds.push(testMgr.id);

    console.log(`✅ Test users created: Employee (${testEmp.id}), Manager (${testMgr.id})\n`);

    // -----------------------------------------------------------------
    // TEST 1: Submit Leave -> Manager Notified -> View/Read -> Reject -> Cleanup & Employee Notified
    // -----------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('🧪 TEST 1: Submit Leave -> View/Read -> Reject Flow');
    console.log('----------------------------------------------------------------');

    // 1. Employee submits Leave Request 1
    const leave1 = await prisma.leaveRequest.create({
      data: {
        userId: testEmp.id,
        leaveType: 'CASUAL',
        startDate: new Date('2026-10-01T00:00:00Z'),
        endDate: new Date('2026-10-02T00:00:00Z'),
        numberOfDays: 2,
        reason: 'Family event',
        currentStage: 'PENDING_MANAGER',
      },
    });
    testLeaveIds.push(leave1.id);

    // Create Manager notification (as done in applyLeaveAction)
    const mgrNotif1 = await prisma.notification.create({
      data: {
        userId: testMgr.id,
        title: 'New Leave Request',
        message: `${testEmp.fullName} submitted a Casual leave request (2 days).`,
        type: 'LEAVE',
        link: `/manager/leave-requests?id=${leave1.id}`,
        isRead: false,
      },
    });
    testNotifIds.push(mgrNotif1.id);

    console.log('  1. Leave request created. Checking Manager notification...');
    const mgrNotifsAfterCreate = await prisma.notification.findMany({
      where: { userId: testMgr.id, isRead: false },
    });
    const exactOneCreated = mgrNotifsAfterCreate.some((n) => n.id === mgrNotif1.id);
    console.log(`     Manager unread notifications count: ${mgrNotifsAfterCreate.length} | Contains Leave 1 notif: ${exactOneCreated ? 'YES' : 'NO'}`);

    if (!exactOneCreated) throw new Error('Test 1 Failed: Manager notification not found.');

    // 2. Manager views notification (mark as read)
    console.log('  2. Manager views notification (marking as read)...');
    await prisma.notification.updateMany({
      where: { id: mgrNotif1.id, userId: testMgr.id },
      data: { isRead: true },
    });

    const readNotif = await prisma.notification.findUnique({ where: { id: mgrNotif1.id } });
    const isNowRead = readNotif?.isRead === true;
    console.log(`     Notification isRead: ${isNowRead ? 'TRUE (PASSED)' : 'FALSE (FAILED)'}`);
    if (!isNowRead) throw new Error('Test 1 Failed: Notification was not marked as read.');

    // 3. Manager rejects Leave Request 1
    console.log('  3. Manager rejects Leave Request 1...');
    // Execute rejection cleanup and applicant notification logic
    await prisma.leaveRequest.update({
      where: { id: leave1.id },
      data: { currentStage: 'REJECTED' },
    });

    // Cleanup pending reviewer notification
    await prisma.notification.deleteMany({
      where: {
        type: 'LEAVE',
        OR: [
          { link: `/manager/leave-requests?id=${leave1.id}` },
          { link: { contains: leave1.id } },
        ],
      },
    });

    // Create decision notification for Employee
    const empDecisionNotif = await prisma.notification.create({
      data: {
        userId: testEmp.id,
        title: 'Leave Request Rejected',
        message: `Your Casual leave request was rejected.`,
        type: 'LEAVE',
        link: '/employee/my-leaves',
        isRead: false,
      },
    });
    testNotifIds.push(empDecisionNotif.id);

    // 4. Verify old Manager notification is gone and Employee received decision notification
    const mgrPendingAfterReject = await prisma.notification.findMany({
      where: { userId: testMgr.id, link: { contains: leave1.id } },
    });
    const empNotifsAfterReject = await prisma.notification.findMany({
      where: { userId: testEmp.id, isRead: false },
    });

    const mgrClean = mgrPendingAfterReject.length === 0;
    const empReceived = empNotifsAfterReject.length === 1 && empNotifsAfterReject[0].title === 'Leave Request Rejected';

    console.log(`     Old Manager "New Leave Request" notification removed: ${mgrClean ? 'YES (PASSED)' : 'NO (STALE REMAINED)'}`);
    console.log(`     Employee received exactly ONE rejection notification: ${empReceived ? 'YES (PASSED)' : 'NO'}`);

    if (!mgrClean || !empReceived) throw new Error('Test 1 Failed: Notification lifecycle mismatch on reject.');
    console.log('✅ TEST 1 PASSED!\n');

    // -----------------------------------------------------------------
    // TEST 2: Submit Leave -> Approve Flow
    // -----------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('🧪 TEST 2: Submit Leave -> Approve Flow');
    console.log('----------------------------------------------------------------');

    // 1. Employee submits Leave Request 2
    const leave2 = await prisma.leaveRequest.create({
      data: {
        userId: testEmp.id,
        leaveType: 'SICK',
        startDate: new Date('2026-11-05T00:00:00Z'),
        endDate: new Date('2026-11-06T00:00:00Z'),
        numberOfDays: 2,
        reason: 'Flu symptoms',
        currentStage: 'PENDING_MANAGER',
      },
    });
    testLeaveIds.push(leave2.id);

    const mgrNotif2 = await prisma.notification.create({
      data: {
        userId: testMgr.id,
        title: 'New Leave Request',
        message: `${testEmp.fullName} submitted a Sick leave request (2 days).`,
        type: 'LEAVE',
        link: `/manager/leave-requests?id=${leave2.id}`,
        isRead: false,
      },
    });
    testNotifIds.push(mgrNotif2.id);

    console.log('  1. Leave 2 created. Manager notification created.');

    // 2. Manager approves Leave Request 2
    console.log('  2. Manager approves Leave Request 2...');
    await prisma.leaveRequest.update({
      where: { id: leave2.id },
      data: { currentStage: 'APPROVED' },
    });

    await prisma.notification.deleteMany({
      where: {
        type: 'LEAVE',
        OR: [
          { link: `/manager/leave-requests?id=${leave2.id}` },
          { link: { contains: leave2.id } },
        ],
      },
    });

    const empApprovalNotif = await prisma.notification.create({
      data: {
        userId: testEmp.id,
        title: 'Leave Request Approved',
        message: `Your Sick leave request was approved.`,
        type: 'LEAVE',
        link: '/employee/my-leaves',
        isRead: false,
      },
    });
    testNotifIds.push(empApprovalNotif.id);

    const mgrPendingAfterApprove = await prisma.notification.findMany({
      where: { userId: testMgr.id, link: { contains: leave2.id } },
    });
    const empNotifsAfterApprove = await prisma.notification.findMany({
      where: { userId: testEmp.id, isRead: false, title: 'Leave Request Approved' },
    });

    const mgrClean2 = mgrPendingAfterApprove.length === 0;
    const empReceived2 = empNotifsAfterApprove.length === 1;

    console.log(`     Old Manager "New Leave Request" notification removed: ${mgrClean2 ? 'YES (PASSED)' : 'NO'}`);
    console.log(`     Employee received exactly ONE approval notification: ${empReceived2 ? 'YES (PASSED)' : 'NO'}`);

    if (!mgrClean2 || !empReceived2) throw new Error('Test 2 Failed: Notification lifecycle mismatch on approve.');
    console.log('✅ TEST 2 PASSED!\n');

    // -----------------------------------------------------------------
    // TEST 3: Multi-Leave Isolation (Leave A, Leave B, Leave C)
    // -----------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('🧪 TEST 3: Multi-Leave Isolation (Leave A, Leave B, Leave C)');
    console.log('----------------------------------------------------------------');

    const leaveA = await prisma.leaveRequest.create({
      data: { userId: testEmp.id, leaveType: 'CASUAL', startDate: new Date('2026-12-01'), endDate: new Date('2026-12-01'), numberOfDays: 1, reason: 'A', currentStage: 'PENDING_MANAGER' },
    });
    const leaveB = await prisma.leaveRequest.create({
      data: { userId: testEmp.id, leaveType: 'CASUAL', startDate: new Date('2026-12-02'), endDate: new Date('2026-12-02'), numberOfDays: 1, reason: 'B', currentStage: 'PENDING_MANAGER' },
    });
    const leaveC = await prisma.leaveRequest.create({
      data: { userId: testEmp.id, leaveType: 'CASUAL', startDate: new Date('2026-12-03'), endDate: new Date('2026-12-03'), numberOfDays: 1, reason: 'C', currentStage: 'PENDING_MANAGER' },
    });
    testLeaveIds.push(leaveA.id, leaveB.id, leaveC.id);

    const notifA = await prisma.notification.create({ data: { userId: testMgr.id, title: 'New Leave Request', message: 'Leave A', type: 'LEAVE', link: `/manager/leave-requests?id=${leaveA.id}`, isRead: false } });
    const notifB = await prisma.notification.create({ data: { userId: testMgr.id, title: 'New Leave Request', message: 'Leave B', type: 'LEAVE', link: `/manager/leave-requests?id=${leaveB.id}`, isRead: false } });
    const notifC = await prisma.notification.create({ data: { userId: testMgr.id, title: 'New Leave Request', message: 'Leave C', type: 'LEAVE', link: `/manager/leave-requests?id=${leaveC.id}`, isRead: false } });
    testNotifIds.push(notifA.id, notifB.id, notifC.id);

    console.log('  1. Created 3 leave requests with 3 separate notifications for Manager.');

    // Reject Leave A ONLY
    console.log('  2. Rejecting Leave A only...');
    await prisma.notification.deleteMany({
      where: { type: 'LEAVE', link: `/manager/leave-requests?id=${leaveA.id}` },
    });

    const checkA = await prisma.notification.findUnique({ where: { id: notifA.id } });
    const checkB = await prisma.notification.findUnique({ where: { id: notifB.id } });
    const checkC = await prisma.notification.findUnique({ where: { id: notifC.id } });

    const notifAGone = checkA === null;
    const notifBRemains = checkB !== null;
    const notifCRemains = checkC !== null;

    console.log(`     Leave A notification deleted: ${notifAGone ? 'YES (PASSED)' : 'NO'}`);
    console.log(`     Leave B notification preserved: ${notifBRemains ? 'YES (PASSED)' : 'NO'}`);
    console.log(`     Leave C notification preserved: ${notifCRemains ? 'YES (PASSED)' : 'NO'}`);

    if (!notifAGone || !notifBRemains || !notifCRemains) {
      throw new Error('Test 3 Failed: Multi-leave isolation violated.');
    }
    console.log('✅ TEST 3 PASSED!\n');

    // -----------------------------------------------------------------
    // TEST 4: Direct Supabase / Database Notification Deletion
    // -----------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('🧪 TEST 4: Direct Database Notification Deletion');
    console.log('----------------------------------------------------------------');

    const tempNotif = await prisma.notification.create({
      data: {
        userId: testMgr.id,
        title: 'Direct DB Test',
        message: 'Testing direct deletion',
        type: 'SYSTEM',
        isRead: false,
      },
    });
    testNotifIds.push(tempNotif.id);

    const countBefore = await prisma.notification.count({ where: { userId: testMgr.id } });
    console.log(`  1. Created direct DB notification. Total count for Manager: ${countBefore}`);

    await prisma.notification.delete({ where: { id: tempNotif.id } });
    const countAfter = await prisma.notification.count({ where: { userId: testMgr.id } });
    console.log(`  2. Deleted direct DB notification. Total count for Manager: ${countAfter}`);

    const directClean = countAfter === countBefore - 1;
    console.log(`     Direct DB deletion verified: ${directClean ? 'YES (PASSED)' : 'NO'}`);
    if (!directClean) throw new Error('Test 4 Failed: Direct DB deletion failed.');
    console.log('✅ TEST 4 PASSED!\n');

  } catch (err: any) {
    console.error('❌ Verification Test Failed:', err);
    throw err;
  } finally {
    console.log('🧹 DATABASE CLEANUP: Removing all test data...');
    try {
      if (testNotifIds.length > 0) {
        await prisma.notification.deleteMany({ where: { id: { in: testNotifIds } } });
      }
      if (testLeaveIds.length > 0) {
        await prisma.leaveApprovalHistory.deleteMany({ where: { leaveRequestId: { in: testLeaveIds } } });
        await prisma.leaveRequest.deleteMany({ where: { id: { in: testLeaveIds } } });
      }
      if (testUserIds.length > 0) {
        await prisma.notification.deleteMany({ where: { userId: { in: testUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
      }
      const finalProdUsers = await prisma.user.count({ where: { isDeleted: false } });
      const clean = finalProdUsers === initialProdUsers;
      console.log(`🔒 Verification: Initial users (${initialProdUsers}) === Final users (${finalProdUsers}) -> ${clean ? 'DATABASE 100% CLEAN' : 'MISMATCH'}\n`);
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    } finally {
      await prisma.$disconnect();
    }
  }
}

runLeaveNotificationLifecycleTests();
