import { prisma } from '@/lib/prisma';

export async function createSafeAuditLog(data: {
  userId?: string | null;
  role?: string;
  action: string;
  target: string;
  details: string;
}) {
  try {
    let validUserId: string | null = null;

    // Verify user actually exists in the database to satisfy Foreign Key
    if (data.userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true },
      });
      if (userExists) {
        validUserId = userExists.id;
      }
    }

    return await prisma.auditLog.create({
      data: {
        userId: validUserId,
        role: data.role || 'SYSTEM',
        action: data.action,
        target: data.target,
        details: data.details,
      },
    });
  } catch (err) {
    console.error('Non-blocking Audit Log Exception:', err);
  }
}