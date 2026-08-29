'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function applyLeaveAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  leave?: any;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const leaveType = (formData.get('leaveType') as string) || 'CASUAL';
  const startDateStr = formData.get('startDate') as string;
  const endDateStr = formData.get('endDate') as string;
  const reason = (formData.get('reason') as string)?.trim() || 'Personal leave';

  if (!startDateStr || !endDateStr) return { success: false, error: 'Start date and end date are required.' };

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (endDate < startDate) return { success: false, error: 'End date cannot be before start date.' };

  const diffDays = Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Check if user has an active team with a team lead
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { team: true },
  });

  const hasTeamLead = user?.team?.teamLeadId && user.team.teamLeadId !== session.id;
  // If submitter is Team Lead or has no Team Lead -> goes straight to Manager
  const initialStage = (session.role === 'TEAM_LEAD' || session.role === 'MANAGER' || !hasTeamLead)
    ? 'PENDING_MANAGER'
    : 'PENDING_TL';

  try {
    const leave = await prisma.leaveRequest.create({
      data: {
        userId: session.id,
        leaveType,
        startDate,
        endDate,
        numberOfDays: diffDays,
        reason,
        currentStage: initialStage,
      },
    });

    await prisma.leaveApprovalHistory.create({
      data: {
        leaveRequestId: leave.id,
        actionById: session.id,
        stage: initialStage,
        action: 'SUBMITTED',
        comments: 'Submitted by employee',
      },
    });

    const leaveWithUser = await prisma.leaveRequest.findUnique({
      where: { id: leave.id },
      include: { user: { include: { team: true } } },
    });

    // Notify reviewer (Team Lead or Managers)
    if (initialStage === 'PENDING_TL' && user?.team?.teamLeadId) {
      await prisma.notification.create({
        data: {
          userId: user.team.teamLeadId,
          title: 'New Leave Request',
          message: `${session.fullName} submitted a ${leaveType.replace(/_/g, ' ')} leave request (${diffDays} days).`,
          type: 'LEAVE',
          link: '/team-lead/leave-requests',
          isRead: false,
        },
      });
    } else {
      const managers = await prisma.user.findMany({
        where: { role: 'MANAGER', isDeleted: false },
        select: { id: true },
      });
      if (managers.length > 0) {
        await prisma.notification.createMany({
          data: managers.map((m) => ({
            userId: m.id,
            title: 'New Leave Request',
            message: `${session.fullName} submitted a ${leaveType.replace(/_/g, ' ')} leave request (${diffDays} days).`,
            type: 'LEAVE',
            link: '/manager/leave-requests',
            isRead: false,
          })),
        });
      }
    }

    appEvents.emit(EVENT_TYPES.LEAVE_STATUS_CHANGED, { leaveId: leave.id, stage: initialStage, leave: leaveWithUser });
    appEvents.emit(EVENT_TYPES.NOTIFICATION_RECEIVED, { leaveId: leave.id });

    revalidatePath('/employee/apply-leave');
    revalidatePath('/employee/my-leaves');
    revalidatePath('/team-lead/leave-requests');
    revalidatePath('/manager/leave-requests');

    return {
      success: true,
      message: 'Leave application submitted successfully!',
      leave: leaveWithUser,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to submit leave application.',
    };
  }
}

export async function processLeaveApprovalAction(
  leaveId: string,
  action: 'APPROVE' | 'REJECT',
  comments?: string
): Promise<{ success: boolean; error?: string; leave?: any }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { user: { include: { team: true } } },
  });
  if (!leave) return { success: false, error: 'Leave request not found.' };

  let nextStage = leave.currentStage;

  if (action === 'REJECT') {
    nextStage = 'REJECTED';
  } else {
    // If TL approves -> PENDING_MANAGER (or APPROVED if Manager acts)
    if (session.role === 'TEAM_LEAD' && leave.currentStage === 'PENDING_TL') {
      nextStage = 'PENDING_MANAGER';
    } else if (session.role === 'MANAGER') {
      nextStage = 'APPROVED';
    }
  }

  if (nextStage === 'APPROVED') {
    await prisma.leaveBalance.updateMany({
      where: {
        userId: leave.userId,
        leaveType: leave.leaveType,
        year: new Date().getFullYear(),
      },
      data: { usedQuota: { increment: leave.numberOfDays } },
    });
  }

  await prisma.leaveRequest.update({
    where: { id: leaveId },
    data: { currentStage: nextStage },
  });

  await prisma.leaveApprovalHistory.create({
    data: {
      leaveRequestId: leaveId,
      actionById: session.id,
      stage: nextStage,
      action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      comments: comments || `Action by ${session.fullName}`,
    },
  });

  const updatedLeave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { user: { include: { team: true } } },
  });

  // Notify applicant
  try {
    await prisma.notification.create({
      data: {
        userId: leave.userId,
        title: action === 'APPROVE' ? 'Leave Request Approved' : 'Leave Request Rejected',
        message: action === 'APPROVE'
          ? (nextStage === 'APPROVED' ? `Your ${leave.leaveType.replace(/_/g, ' ')} leave request was approved.` : `Your leave request was recommended by ${session.fullName} and forwarded to Management.`)
          : `Your ${leave.leaveType.replace(/_/g, ' ')} leave request was rejected.`,
        type: 'LEAVE',
        link: '/employee/apply-leave',
        isRead: false,
      },
    });

    // If forwarded to manager, also notify manager
    if (nextStage === 'PENDING_MANAGER') {
      const managers = await prisma.user.findMany({
        where: { role: 'MANAGER', isDeleted: false },
        select: { id: true },
      });
      if (managers.length > 0) {
        await prisma.notification.createMany({
          data: managers.map((m) => ({
            userId: m.id,
            title: 'Leave Request Pending Final Approval',
            message: `${leave.user?.fullName}'s leave request was approved by Team Lead and awaits your review.`,
            type: 'LEAVE',
            link: '/manager/leave-requests',
            isRead: false,
          })),
        });
      }
    }
  } catch {}

  appEvents.emit(EVENT_TYPES.LEAVE_STATUS_CHANGED, { leaveId, stage: nextStage, leave: updatedLeave });
  appEvents.emit(EVENT_TYPES.NOTIFICATION_RECEIVED, { leaveId });

  revalidatePath('/manager/leave-requests');
  revalidatePath('/manager/attendance');
  revalidatePath('/manager');
  revalidatePath('/team-lead/leave-requests');
  revalidatePath('/team-lead');
  revalidatePath('/employee/apply-leave');
  revalidatePath('/employee/my-leaves');

  return { success: true, leave: updatedLeave };
}
