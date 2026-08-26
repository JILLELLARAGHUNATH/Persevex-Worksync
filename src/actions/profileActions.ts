'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { createSafeAuditLog } from '@/lib/audit';

export async function updateMyProfileAction(data: {
  fullName: string;
  email: string;
  phone?: string;
  designation?: string;
}): Promise<{ success: boolean; error?: string; user?: any }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'Unauthorized: Please log in again.' };
    }

    const { fullName, email, phone, designation } = data;

    if (!fullName || !email) {
      return { success: false, error: 'Full Name and Email are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email is used by another user
    const existing = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        id: { not: session.id },
        isDeleted: false,
      },
    });

    if (existing) {
      return { success: false, error: 'This email is already in use by another team member.' };
    }

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: {
        fullName: fullName.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : null,
        designation: designation ? designation.trim() : undefined,
      },
    });

    await createSafeAuditLog({
      userId: session.id,
      role: session.role,
      action: 'PROFILE_UPDATED',
      target: `User#${session.id}`,
      details: `User updated profile information: ${fullName} (${cleanEmail})`,
    });

    revalidatePath('/profile');
    revalidatePath('/manager');
    revalidatePath('/team-lead');
    revalidatePath('/employee');

    return { success: true, user: updated };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update profile.' };
  }
}

export async function updateMyPasswordAction(data: {
  currentPassword?: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const { currentPassword, newPassword } = data;

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return { success: false, error: 'Current password is incorrect.' };
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: session.id },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    await createSafeAuditLog({
      userId: session.id,
      role: session.role,
      action: 'PASSWORD_CHANGED',
      target: `User#${session.id}`,
      details: 'User updated their account password.',
    });

    revalidatePath('/profile');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to change password.' };
  }
}
