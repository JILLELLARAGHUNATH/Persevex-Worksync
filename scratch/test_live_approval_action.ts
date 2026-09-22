import { prisma } from '../src/lib/prisma';
import { processLeaveApprovalAction } from '../src/actions/leaveActions';

async function testLiveApproval() {
  console.log('Testing live leave approval action...');

  // Find or create a test pending leave
  const user = await prisma.user.findFirst({
    where: { role: 'EMPLOYEE', isDeleted: false },
  });

  const manager = await prisma.user.findFirst({
    where: { role: 'MANAGER', isDeleted: false },
  });

  if (!user || !manager) {
    console.error('Could not find user or manager');
    return;
  }

  // Create a pending leave request
  const testLeave = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      leaveType: 'CASUAL',
      startDate: new Date('2026-09-17T00:00:00.000Z'),
      endDate: new Date('2026-09-22T00:00:00.000Z'),
      numberOfDays: 6,
      reason: 'Automated test request',
      currentStage: 'PENDING_MANAGER',
    },
  });

  console.log('Created test leave:', testLeave.id);

  // Approve it via processLeaveApprovalAction (simulated)
  // Let's directly invoke prisma update to ensure no schema issues
  try {
    const splitRes = {
      monthAllocation: { '2026-09': { paid: 1.5, unpaid: 4.5 } },
      dayAllocations: {},
      paidDays: 1.5,
      unpaidDays: 4.5,
    };
    const structuredNote = JSON.stringify({
      userNote: '1.5d Paid + 4.5d Unpaid',
      monthAllocation: splitRes.monthAllocation,
      dayAllocations: splitRes.dayAllocations,
      paidDays: 1.5,
      unpaidDays: 4.5,
    });

    const updated = await prisma.leaveRequest.update({
      where: { id: testLeave.id },
      data: {
        numberOfDays: 6,
        currentStage: 'APPROVED',
        payTreatment: 'SPLIT',
        managerNote: structuredNote,
        approvedById: manager.id,
        approvedAt: new Date(),
      },
    });

    console.log('Successfully updated leave with Prisma:', updated.id, updated.payTreatment);
    console.log('ManagerNote persisted:', updated.managerNote);

    // Clean up test leave
    await prisma.leaveRequest.delete({ where: { id: testLeave.id } });
    console.log('Cleaned up test leave.');
    console.log('ALL PRISMA OPERATIONS SUCCESSFUL!');
  } catch (err: any) {
    console.error('FAILED TO UPDATE LEAVE:', err);
    await prisma.leaveRequest.delete({ where: { id: testLeave.id } }).catch(() => {});
  }
}

testLiveApproval().catch(console.error);
