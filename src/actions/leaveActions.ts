'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { calculateApplicableLeaveDays } from '@/lib/calendar';
import { getIndiaDateKey } from '@/lib/attendanceDate';
import {
  calculateLeaveRequestSplit,
  isEligibleForMonthlyPaidLeave,
  MonthLeaveSplit,
  MONTHLY_PAID_LEAVE_QUOTA,
  findConflictingLeave,
  doLeaveDatesOverlap,
} from '@/lib/leaveEntitlement';

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
  const isHalfDay = formData.get('isHalfDay') === 'true' || formData.get('duration') === 'HALF_DAY';

  if (!startDateStr || !endDateStr) return { success: false, error: 'Start date and end date are required.' };

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (endDate < startDate) return { success: false, error: 'End date cannot be before start date.' };

  const startKey = getIndiaDateKey(startDate);
  const endKey = getIndiaDateKey(endDate);

  try {
    const { leaveWithUser, initialStage } = await prisma.$transaction(async (tx) => {
      // Check for active or approved overlapping leaves for this employee inside the transaction
      const existingUserLeaves = await tx.leaveRequest.findMany({
        where: {
          userId: session.id,
          currentStage: { in: ['PENDING_TL', 'PENDING_MANAGER', 'APPROVED'] },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          currentStage: true,
          leaveType: true,
        },
      });

      const conflictingLeave = findConflictingLeave(startDate, endDate, existingUserLeaves, {
        allowedStages: ['PENDING_TL', 'PENDING_MANAGER', 'APPROVED'],
      });

      if (conflictingLeave) {
        const conflictStart = getIndiaDateKey(conflictingLeave.startDate);
        const conflictEnd = getIndiaDateKey(conflictingLeave.endDate);
        const statusLabel =
          conflictingLeave.currentStage === 'APPROVED'
            ? 'Approved'
            : 'Pending Review';
        const rangeLabel =
          conflictStart === conflictEnd
            ? conflictStart
            : `${conflictStart} to ${conflictEnd}`;

        throw new Error(
          `You already have a leave request covering ${rangeLabel} (${statusLabel}). Overlapping leave requests are not permitted.`
        );
      }

      // Authoritative Work Calendar calculation
      const calendarOverrides = await tx.companyCalendar.findMany({
        where: {
          dateKey: { gte: startKey, lte: endKey },
        },
      });

      const leaveCalc = calculateApplicableLeaveDays(startDate, endDate, calendarOverrides);
      const isSingleDay = leaveCalc.breakdown.length === 1;
      const applicableDays = isHalfDay && isSingleDay
        ? 0.5 * leaveCalc.applicableLeaveDays
        : leaveCalc.applicableLeaveDays;

      // Check if user has an active team with a team lead
      const user = await tx.user.findUnique({
        where: { id: session.id },
        include: { team: true },
      });

      const hasTeamLead = user?.team?.teamLeadId && user.team.teamLeadId !== session.id;
      // If submitter is Team Lead or has no Team Lead -> goes straight to Manager
      const initialStage = (session.role === 'TEAM_LEAD' || session.role === 'MANAGER' || !hasTeamLead)
        ? 'PENDING_MANAGER'
        : 'PENDING_TL';

      const leave = await tx.leaveRequest.create({
        data: {
          userId: session.id,
          leaveType,
          startDate,
          endDate,
          numberOfDays: applicableDays,
          reason,
          currentStage: initialStage,
        },
      });

      await tx.leaveApprovalHistory.create({
        data: {
          leaveRequestId: leave.id,
          actionById: session.id,
          stage: initialStage,
          action: 'SUBMITTED',
          comments: `Submitted by employee (${applicableDays} working ${applicableDays === 1 ? 'day' : 'days'} · ${leaveCalc.totalCalendarDays} calendar days)`,
        },
      });

      const leaveWithUser = await tx.leaveRequest.findUnique({
        where: { id: leave.id },
        include: { user: { include: { team: true } } },
      });

      // Notify reviewer with deterministic leave ID reference in link
      if (initialStage === 'PENDING_TL' && user?.team?.teamLeadId) {
        await tx.notification.create({
          data: {
            userId: user.team.teamLeadId,
            title: 'New Leave Request',
            message: `${session.fullName} submitted a ${leaveType.replace(/_/g, ' ')} leave request (${applicableDays} days).`,
            type: 'LEAVE',
            link: `/team-lead/leave-requests?id=${leave.id}`,
            isRead: false,
          },
        });
      } else {
        const managers = await tx.user.findMany({
          where: { role: 'MANAGER', isDeleted: false },
          select: { id: true },
        });
        if (managers.length > 0) {
          const roleLabel = session.role === 'TEAM_LEAD' ? ' (Team Lead)' : '';
          await tx.notification.createMany({
            data: managers.map((m) => ({
              userId: m.id,
              title: 'New Leave Request',
              message: `${session.fullName}${roleLabel} submitted a ${leaveType.replace(/_/g, ' ')} leave request (${applicableDays} days).`,
              type: 'LEAVE',
              link: `/manager/leave-requests?id=${leave.id}`,
              isRead: false,
            })),
          });
        }
      }

      return { leaveWithUser, initialStage };
    });

    if (leaveWithUser) {
      appEvents.emit(EVENT_TYPES.LEAVE_STATUS_CHANGED, { leaveId: leaveWithUser.id, stage: initialStage, leave: leaveWithUser });
      appEvents.emit(EVENT_TYPES.NOTIFICATION_RECEIVED, { leaveId: leaveWithUser.id });
    }

    revalidatePath('/employee/apply-leave');
    revalidatePath('/employee/my-leaves');
    revalidatePath('/team-lead/apply-leave');
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

/**
 * Returns the authoritative leave entitlement preview and split calculation for Manager approval UI.
 */
export async function getLeaveRequestEntitlementPreviewAction(leaveId: string): Promise<{
  success: boolean;
  error?: string;
  preview?: {
    totalApplicableDays: number;
    totalPaidDays: number;
    totalUnpaidDays: number;
    payTreatment: 'PAID' | 'UNPAID' | 'SPLIT';
    isEligible: boolean;
    monthSplits: MonthLeaveSplit[];
    isExhausted: boolean;
  };
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { user: { include: { team: true } } },
  });
  if (!leave) return { success: false, error: 'Leave request not found.' };

  const startKey = getIndiaDateKey(leave.startDate);
  const endKey = getIndiaDateKey(leave.endDate);
  const calendarOverrides = await prisma.companyCalendar.findMany({
    where: {
      dateKey: { gte: startKey, lte: endKey },
    },
  });

  const existingApproved = await prisma.leaveRequest.findMany({
    where: {
      userId: leave.userId,
      currentStage: 'APPROVED',
      id: { not: leaveId },
    },
  });

  const conflictingApproved = findConflictingLeave(
    leave.startDate,
    leave.endDate,
    existingApproved,
    { excludeLeaveId: leaveId, allowedStages: ['APPROVED'] }
  );

  if (conflictingApproved) {
    const conflictStart = getIndiaDateKey(conflictingApproved.startDate);
    const conflictEnd = getIndiaDateKey(conflictingApproved.endDate);
    const rangeLabel =
      conflictStart === conflictEnd
        ? conflictStart
        : `${conflictStart} to ${conflictEnd}`;

    return {
      success: false,
      error: `Cannot approve: this employee already has an approved leave covering ${rangeLabel}. Overlapping leave requests cannot be approved.`,
    };
  }

  const isHalfDay = leave.numberOfDays === 0.5 && leave.startDate.getTime() === leave.endDate.getTime();

  const splitRes = calculateLeaveRequestSplit({
    user: leave.user,
    startDate: leave.startDate,
    endDate: leave.endDate,
    isHalfDay,
    calendarOverrides,
    existingApprovedLeaves: existingApproved,
  });

  const isExhausted = splitRes.monthSplits.length > 0 && splitRes.monthSplits.every((m) => m.remainingBefore === 0);

  return {
    success: true,
    preview: {
      totalApplicableDays: splitRes.totalApplicableDays,
      totalPaidDays: splitRes.totalPaidDays,
      totalUnpaidDays: splitRes.totalUnpaidDays,
      payTreatment: splitRes.payTreatment,
      isEligible: splitRes.isEligible,
      monthSplits: splitRes.monthSplits,
      isExhausted,
    },
  };
}

export async function processLeaveApprovalAction(
  leaveId: string,
  action: 'APPROVE' | 'REJECT',
  comments?: string,
  _ignoredPayTreatment?: string,
  managerNote?: string
): Promise<{ success: boolean; error?: string; leave?: any }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const leave = await tx.leaveRequest.findUnique({
        where: { id: leaveId },
        include: { user: { include: { team: true } } },
      });
      if (!leave) throw new Error('Leave request not found.');

      // Strictly prevent self-approval by non-manager users (e.g., Team Leads approving own leave)
      if (leave.userId === session.id && session.role !== 'MANAGER') {
        throw new Error('Self-approval is strictly prohibited. Your leave request must be reviewed and approved by Management.');
      }

      let nextStage = leave.currentStage;
      let finalPayTreatment: string | null = leave.payTreatment;
      let finalPaidDays = 0;
      let finalUnpaidDays = 0;
      let finalLeaveDays = Number(leave.numberOfDays) || 0;
      let finalManagerNote: string | null = managerNote || comments || null;

      if (leave.managerNote) {
        try {
          const p = JSON.parse(leave.managerNote);
          if (p.paidDays !== undefined) finalPaidDays = Number(p.paidDays) || 0;
          if (p.unpaidDays !== undefined) finalUnpaidDays = Number(p.unpaidDays) || 0;
        } catch {}
      }

      // Re-evaluate applicable leave days dynamically against authoritative Work Calendar
      const startKey = getIndiaDateKey(leave.startDate);
      const endKey = getIndiaDateKey(leave.endDate);
      const calendarOverrides = await tx.companyCalendar.findMany({
        where: {
          dateKey: { gte: startKey, lte: endKey },
        },
      });

      if (action === 'REJECT') {
        nextStage = 'REJECTED';
      } else {
        // If TL approves -> PENDING_MANAGER (or APPROVED if Manager acts)
        if (session.role === 'TEAM_LEAD' && leave.currentStage === 'PENDING_TL') {
          // Check if an approved leave already covers this date range
          const existingApproved = await tx.leaveRequest.findMany({
            where: {
              userId: leave.userId,
              currentStage: 'APPROVED',
              id: { not: leaveId },
            },
            select: { id: true, startDate: true, endDate: true, currentStage: true },
          });

          const conflictingApproved = findConflictingLeave(
            leave.startDate,
            leave.endDate,
            existingApproved,
            { excludeLeaveId: leaveId, allowedStages: ['APPROVED'] }
          );

          if (conflictingApproved) {
            const conflictStart = getIndiaDateKey(conflictingApproved.startDate);
            const conflictEnd = getIndiaDateKey(conflictingApproved.endDate);
            const rangeLabel =
              conflictStart === conflictEnd
                ? conflictStart
                : `${conflictStart} to ${conflictEnd}`;

            throw new Error(`Cannot forward request: an approved leave already exists covering ${rangeLabel}.`);
          }

          nextStage = 'PENDING_MANAGER';
        } else if (session.role === 'MANAGER') {
          nextStage = 'APPROVED';

          // Authoritative transactional server-side calculation of 1.5-day monthly entitlement
          const existingApproved = await tx.leaveRequest.findMany({
            where: {
              userId: leave.userId,
              currentStage: 'APPROVED',
              id: { not: leaveId },
            },
          });

          // Strict Concurrency & Overlap Guard inside transaction:
          // Ensure no other approved leave covers these dates before approving
          const conflictingApproved = findConflictingLeave(
            leave.startDate,
            leave.endDate,
            existingApproved,
            { excludeLeaveId: leaveId, allowedStages: ['APPROVED'] }
          );

          if (conflictingApproved) {
            const conflictStart = getIndiaDateKey(conflictingApproved.startDate);
            const conflictEnd = getIndiaDateKey(conflictingApproved.endDate);
            const rangeLabel =
              conflictStart === conflictEnd
                ? conflictStart
                : `${conflictStart} to ${conflictEnd}`;

            throw new Error(`Approval failed: this employee already has an approved leave covering ${rangeLabel}. Overlapping leave requests cannot be approved.`);
          }

          const isHalfDay = leave.numberOfDays === 0.5 && leave.startDate.getTime() === leave.endDate.getTime();

          const splitRes = calculateLeaveRequestSplit({
            user: leave.user,
            startDate: leave.startDate,
            endDate: leave.endDate,
            isHalfDay,
            calendarOverrides,
            existingApprovedLeaves: existingApproved,
          });

          finalLeaveDays = splitRes.totalApplicableDays;
          finalPaidDays = splitRes.totalPaidDays;
          finalUnpaidDays = splitRes.totalUnpaidDays;
          finalPayTreatment = splitRes.payTreatment;

          if (_ignoredPayTreatment === 'UNPAID') {
            finalPaidDays = 0;
            finalUnpaidDays = splitRes.totalApplicableDays;
            finalPayTreatment = 'UNPAID';
          }

          // Store structured month allocation for multi-month leaves and payroll audit
          const structuredNote = JSON.stringify({
            userNote: managerNote || comments || '',
            monthAllocation: splitRes.monthAllocation,
            dayAllocations: splitRes.dayAllocations,
            paidDays: finalPaidDays,
            unpaidDays: finalUnpaidDays,
          });
          finalManagerNote = structuredNote;
        }
      }

      if (nextStage === 'APPROVED') {
        await tx.leaveBalance.updateMany({
          where: {
            userId: leave.userId,
            leaveType: leave.leaveType,
            year: new Date().getFullYear(),
          },
          data: { usedQuota: { increment: finalPaidDays } },
        });
      }

      await tx.leaveRequest.update({
        where: { id: leaveId },
        data: {
          numberOfDays: finalLeaveDays,
          currentStage: nextStage,
          payTreatment: finalPayTreatment,
          managerNote: finalManagerNote,
          ...(session.role === 'MANAGER' && action === 'APPROVE'
            ? { approvedById: session.id, approvedAt: new Date() }
            : {}),
        },
      });

      const approvalSummary =
        action === 'APPROVE'
          ? finalPaidDays > 0 && finalUnpaidDays > 0
            ? `Approved: ${finalPaidDays}d Paid + ${finalUnpaidDays}d Unpaid`
            : finalPaidDays > 0
            ? `Approved as Paid Leave (${finalPaidDays}d)`
            : `Approved as Unpaid Leave (${finalUnpaidDays}d)`
          : 'Rejected by Management';

      await tx.leaveApprovalHistory.create({
        data: {
          leaveRequestId: leaveId,
          actionById: session.id,
          stage: nextStage,
          action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          comments: comments || approvalSummary,
        },
      });

      // If Manager approved/rejected, check if any finalized payroll month needs recalculation
      if (session.role === 'MANAGER') {
        try {
          const startMonth = leave.startDate.toISOString().substring(0, 7);
          const endMonth = leave.endDate.toISOString().substring(0, 7);
          await tx.payrollRecord.updateMany({
            where: {
              monthKey: { in: [startMonth, endMonth] },
              status: 'FINALIZED',
            },
            data: {
              status: 'RECALCULATION_REQUIRED',
            },
          });
        } catch {}
      }

      const updatedLeave = await tx.leaveRequest.findUnique({
        where: { id: leaveId },
        include: { user: { include: { team: true } } },
      });

      // Clean up all pending reviewer notifications for this specific leave request
      try {
        await tx.notification.deleteMany({
          where: {
            type: 'LEAVE',
            OR: [
              { link: `/manager/leave-requests?id=${leaveId}` },
              { link: `/team-lead/leave-requests?id=${leaveId}` },
              { link: { contains: leaveId } },
            ],
          },
        });
      } catch {}

      // Notify submitter of approval / rejection
      try {
        const actionLabel = action === 'APPROVE' ? 'approved' : 'rejected';
        const splitLabel =
          action === 'APPROVE'
            ? finalPaidDays > 0 && finalUnpaidDays > 0
              ? ` (${finalPaidDays}d Paid + ${finalUnpaidDays}d Unpaid)`
              : finalPaidDays > 0
              ? ' (Paid)'
              : ' (Unpaid)'
            : '';

        await tx.notification.create({
          data: {
            userId: leave.userId,
            title: `Leave Request ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
            message: `Your ${leave.leaveType.replace(/_/g, ' ')} leave request from ${leave.startDate.toISOString().split('T')[0]} to ${leave.endDate.toISOString().split('T')[0]} was ${actionLabel}${splitLabel}.`,
            type: 'LEAVE',
            link: '/employee/my-leaves',
            isRead: false,
          },
        });
      } catch {}

      return {
        updatedLeave,
        nextStage,
        finalPaidDays,
        finalUnpaidDays,
        userId: leave.userId,
      };
    });

    const returnLeave = result.updatedLeave
      ? {
          ...result.updatedLeave,
          paidDays: result.finalPaidDays,
          unpaidDays: result.finalUnpaidDays,
        }
      : null;

    appEvents.emit(EVENT_TYPES.LEAVE_STATUS_CHANGED, { leaveId, stage: result.nextStage, leave: returnLeave });
    appEvents.emit(EVENT_TYPES.NOTIFICATION_RECEIVED, { leaveId, userId: result.userId });

    revalidatePath('/employee/apply-leave');
    revalidatePath('/employee/my-leaves');
    revalidatePath('/team-lead/apply-leave');
    revalidatePath('/team-lead/leave-requests');
    revalidatePath('/manager/leave-requests');
    revalidatePath('/manager/work-calendar');
    revalidatePath('/manager/salary-payroll');

    return { success: true, leave: returnLeave };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to process leave approval.',
    };
  }
}

export async function deleteLeaveAction(leaveId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { user: true },
    });
    if (!leave) return { success: false, error: 'Leave request not found.' };

    const isOwner = leave.userId === session.id;
    const isManager = session.role === 'MANAGER';
    if (!isOwner && !isManager) {
      return { success: false, error: 'You are not authorized to delete this leave request.' };
    }

    if (!isManager && leave.currentStage === 'APPROVED') {
      return { success: false, error: 'Approved leave cannot be deleted by employee. Please contact your manager.' };
    }

    // If deleting an approved leave, restore used quota
    if (leave.currentStage === 'APPROVED') {
      let paidToRestore = 0;
      if (leave.managerNote) {
        try {
          const parsed = JSON.parse(leave.managerNote);
          if (parsed.paidDays !== undefined) {
            paidToRestore = Number(parsed.paidDays) || 0;
          }
        } catch {}
      }
      if (paidToRestore === 0 && leave.payTreatment === 'PAID') {
        paidToRestore = Number(leave.numberOfDays) || 0;
      }

      if (paidToRestore > 0) {
        await prisma.leaveBalance.updateMany({
          where: {
            userId: leave.userId,
            leaveType: leave.leaveType,
            year: new Date(leave.startDate).getFullYear(),
          },
          data: {
            usedQuota: { decrement: paidToRestore },
          },
        });
      }

      // Check if finalized payroll month needs recalculation
      const startMonth = leave.startDate.toISOString().substring(0, 7);
      const endMonth = leave.endDate.toISOString().substring(0, 7);
      await prisma.payrollRecord.updateMany({
        where: {
          monthKey: { in: [startMonth, endMonth] },
          status: 'FINALIZED',
        },
        data: {
          status: 'RECALCULATION_REQUIRED',
        },
      });
    }

    // Delete associated notifications
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { link: `/manager/leave-requests?id=${leaveId}` },
          { link: `/team-lead/leave-requests?id=${leaveId}` },
          { link: { contains: leaveId } },
        ],
      },
    });

    await prisma.leaveRequest.delete({
      where: { id: leaveId },
    });

    appEvents.emit(EVENT_TYPES.LEAVE_STATUS_CHANGED, {
      leaveId,
      stage: 'DELETED',
      type: 'LEAVE_DELETED',
    });

    revalidatePath('/employee/my-leaves');
    revalidatePath('/team-lead/leave-requests');
    revalidatePath('/manager/leave-requests');
    revalidatePath('/manager/work-calendar');
    revalidatePath('/manager/salary-payroll');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete leave request.' };
  }
}
