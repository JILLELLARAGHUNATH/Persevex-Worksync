'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { createSafeAuditLog } from '@/lib/audit';
import { appEvents, EVENT_TYPES } from '@/lib/events';

export async function softDeleteEmployeeAction(userId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized: Only Managers can remove employees.' };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: 'Target employee record not found.' };

  if (
    target.role === 'MANAGER' ||
    target.fullName.toLowerCase().includes('shanmukh') ||
    target.email.toLowerCase() === 'admin@persevex.com'
  ) {
    return {
      success: false,
      error: 'CRITICAL PROTECTION: Master Manager & Organizer accounts (Shanmukh) cannot be deleted or archived.',
    };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isDeleted: true, accountStatus: 'SUSPENDED', teamId: null },
  });

  // If this user was a Team Lead, unset teamLeadId on any led teams
  await prisma.team.updateMany({
    where: { teamLeadId: userId },
    data: { teamLeadId: null },
  });

  await createSafeAuditLog({
    userId: session.id,
    role: session.role,
    action: 'EMPLOYEE_ARCHIVED',
    target: `User#${userId}`,
    details: `Archived record for ${target.fullName} (${target.employeeId})`,
  });

  appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, {
    action: 'EMPLOYEE_DELETED',
    userId,
    user: updated,
  });

  revalidatePath('/manager/employees');
  revalidatePath('/manager/teams');
  revalidatePath('/manager/attendance');
  revalidatePath('/manager');
  revalidatePath('/team-lead');
  revalidatePath('/team-lead/team-members');

  return { success: true };
}

export async function toggleAccountStatusAction(userId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized: Only Managers can toggle account status.' };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: 'Target employee record not found.' };

  if (
    target.role === 'MANAGER' ||
    target.fullName.toLowerCase().includes('shanmukh') ||
    target.email.toLowerCase() === 'admin@persevex.com'
  ) {
    return {
      success: false,
      error: 'CRITICAL PROTECTION: Master Manager & Organizer accounts cannot be deactivated.',
    };
  }

  const nextStatus = target.accountStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: nextStatus },
  });

  await createSafeAuditLog({
    userId: session.id,
    role: session.role,
    action: 'EMPLOYEE_STATUS_TOGGLED',
    target: `User#${userId}`,
    details: `Changed status of ${target.fullName} to ${nextStatus}`,
  });

  appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, {
    action: 'STATUS_TOGGLED',
    userId,
    user: updated,
  });

  revalidatePath('/manager/employees');
  revalidatePath('/manager/attendance');
  revalidatePath('/manager/teams');
  revalidatePath('/manager');
  revalidatePath('/team-lead');
  revalidatePath('/team-lead/team-members');

  return { success: true };
}

export async function resetEmployeePasswordAction(
  userId: string,
  newPassword?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized: Only Managers can reset passwords.' };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: 'User not found.' };

  const passToSet = (newPassword && newPassword.trim().length >= 6) ? newPassword.trim() : 'Persevex@123';
  const hashedPassword = await bcrypt.hash(passToSet, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword, mustChangePassword: true },
  });

  await createSafeAuditLog({
    userId: session.id,
    role: session.role,
    action: 'PASSWORD_RESET',
    target: `User#${userId}`,
    details: `Reset password for ${target.fullName} (${target.employeeId})`,
  });

  return { success: true, message: `Password reset to ${passToSet}` };
}

export async function saveEmployeeAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  data?: any;
}> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized: Only Managers can add or update employees.' };
  }

  const id = formData.get('id')?.toString();
  const fullName = formData.get('fullName')?.toString().trim();
  let employeeId = formData.get('employeeId')?.toString().trim();
  const email = formData.get('email')?.toString().trim().toLowerCase();
  const phone = formData.get('phone')?.toString().trim() || null;
  const role = (formData.get('role')?.toString() || 'EMPLOYEE') as any;
  const designation = formData.get('designation')?.toString().trim() || (role === 'TEAM_LEAD' ? 'Team Lead' : 'Associate');
  const teamIdRaw = formData.get('teamId')?.toString().trim();
  const teamId = teamIdRaw && teamIdRaw !== '' && teamIdRaw !== 'NONE' ? teamIdRaw : null;

  if (!fullName || !email) {
    return { success: false, error: 'Full name and email are mandatory.' };
  }

  try {
    if (id) {
      // UPDATE MODE
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) return { success: false, error: 'Target employee not found.' };

      if (email !== existing.email) {
        const emailTaken = await prisma.user.findFirst({ where: { email, id: { not: id } } });
        if (emailTaken) return { success: false, error: 'Email address is already in use by another member.' };
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          fullName,
          email,
          phone,
          role,
          designation,
          teamId,
        },
        include: { team: true },
      });

      // If promoted to TEAM_LEAD and assigned to a team, update the team lead
      if (role === 'TEAM_LEAD' && teamId) {
        await prisma.team.update({
          where: { id: teamId },
          data: { teamLeadId: id },
        });
      }

      await createSafeAuditLog({
        userId: session.id,
        role: session.role,
        action: 'EMPLOYEE_UPDATED',
        target: `User#${id}`,
        details: `Updated details for ${fullName}`,
      });

      appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, {
        action: 'EMPLOYEE_UPDATED',
        user: updated,
      });

      revalidatePath('/manager/employees');
      revalidatePath('/manager/teams');
      revalidatePath('/manager/attendance');
      revalidatePath('/manager');
      revalidatePath('/team-lead');
      revalidatePath('/team-lead/team-members');

      return { success: true, message: 'Employee record updated successfully.', data: updated };
    } else {
      // CREATE MODE
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return { success: false, error: 'An account with this email address already exists.' };
      }

      if (!employeeId) {
        let count = await prisma.user.count();
        const prefix = role === 'TEAM_LEAD' ? 'EMP-TL' : 'EMP';
        let candidateId = `${prefix}-${String(count + 101).padStart(3, '0')}`;
        while (await prisma.user.findUnique({ where: { employeeId: candidateId } })) {
          count++;
          candidateId = `${prefix}-${String(count + 101).padStart(3, '0')}`;
        }
        employeeId = candidateId;
      } else {
        const idTaken = await prisma.user.findUnique({ where: { employeeId } });
        if (idTaken) {
          return { success: false, error: `Employee ID ${employeeId} is already in use.` };
        }
      }

      const defaultPassword = 'Persevex@123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      const newUser = await prisma.user.create({
        data: {
          fullName,
          employeeId,
          email,
          phone,
          password: passwordHash,
          role,
          designation,
          accountStatus: 'ACTIVE',
          mustChangePassword: true,
          teamId,
        },
        include: { team: true },
      });

      // Create standard leave balances for new employee
      const leaveTypes = ['CASUAL', 'SICK', 'PAID', 'WORK_FROM_HOME', 'EMERGENCY'];
      const currentYear = new Date().getFullYear();
      for (const lt of leaveTypes) {
        await prisma.leaveBalance.create({
          data: {
            userId: newUser.id,
            leaveType: lt,
            totalQuota: lt === 'PAID' ? 18 : lt === 'CASUAL' ? 12 : 6,
            usedQuota: 0,
            year: currentYear,
          },
        });
      }

      // If created as TEAM_LEAD and teamId provided, link to team
      if (role === 'TEAM_LEAD' && teamId) {
        await prisma.team.update({
          where: { id: teamId },
          data: { teamLeadId: newUser.id },
        });
      }

      await createSafeAuditLog({
        userId: session.id,
        role: session.role,
        action: 'EMPLOYEE_CREATED',
        target: `User#${newUser.id}`,
        details: `Created new employee ${fullName} (${employeeId})`,
      });

      appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, {
        action: 'EMPLOYEE_CREATED',
        user: newUser,
      });

      revalidatePath('/manager/employees');
      revalidatePath('/manager/teams');
      revalidatePath('/manager/attendance');
      revalidatePath('/manager');
      revalidatePath('/team-lead');
      revalidatePath('/team-lead/team-members');

      return {
        success: true,
        message: `Employee created! Default password: ${defaultPassword}`,
        data: newUser,
      };
    }
  } catch (err: any) {
    console.error('saveEmployeeAction error:', err);
    return { success: false, error: err.message || 'Failed to save employee.' };
  }
}

// Aliases for seamless component compatibility
export async function saveMemberAction(formData: FormData) {
  return saveEmployeeAction(formData);
}

export async function createEmployeeAction(formData: FormData) {
  return saveEmployeeAction(formData);
}

export async function deleteEmployeeAction(userId: string) {
  return softDeleteEmployeeAction(userId);
}

export async function toggleMemberStatusAction(userId: string) {
  return toggleAccountStatusAction(userId);
}

export async function resetPasswordAction(userId: string, newPassword?: string) {
  return resetEmployeePasswordAction(userId, newPassword);
}