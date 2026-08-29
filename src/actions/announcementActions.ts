'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { appEvents, EVENT_TYPES } from '@/lib/events';

export async function saveAnnouncementAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  announcement?: any;
  announcementId?: string;
}> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized: Only Managers can broadcast announcements.' };
  }

  const id = (formData.get('id') as string)?.trim() || null;
  const title = (formData.get('title') as string)?.trim();
  const content = (formData.get('content') as string)?.trim();
  const priority = (formData.get('priority') as string) || 'NORMAL';
  const targetType = (formData.get('targetType') as string) || 'ALL';
  const targetId = (formData.get('targetId') as string) || null;

  if (!title || !content) return { success: false, error: 'Title and content are required.' };

  try {
    let createdAnnouncement: any = undefined;
    if (id) {
      createdAnnouncement = await prisma.announcement.update({
        where: { id },
        data: { title, content, priority, targetType, targetId },
        include: { createdBy: true, reads: true },
      });
      appEvents.emit(EVENT_TYPES.SYSTEM_ANNOUNCEMENT, { type: 'ANNOUNCEMENT_UPDATED', announcementId: id, announcement: createdAnnouncement });
    } else {
      const count = await prisma.announcement.count();
      const announcementCode = `ANC-${count + 101}`;
      createdAnnouncement = await prisma.announcement.create({
        data: {
          announcementCode,
          title,
          content,
          priority,
          targetType,
          targetId,
          createdById: session.id,
        },
        include: { createdBy: true, reads: true },
      });

      // Target users for notification delivery
      let targetUsers: { id: string }[] = [];
      if (targetType === 'TEAM' && targetId) {
        targetUsers = await prisma.user.findMany({
          where: { isDeleted: false, teamId: targetId, id: { not: session.id } },
          select: { id: true },
        });
      } else if (targetType === 'SPECIFIC_EMPLOYEES' && targetId) {
        targetUsers = await prisma.user.findMany({
          where: { isDeleted: false, id: targetId },
          select: { id: true },
        });
      } else {
        targetUsers = await prisma.user.findMany({
          where: { isDeleted: false, id: { not: session.id } },
          select: { id: true },
        });
      }

      if (targetUsers.length > 0) {
        await prisma.notification.createMany({
          data: targetUsers.map((u) => ({
            userId: u.id,
            title: `New Announcement: ${title}`,
            message: content.length > 120 ? `${content.slice(0, 117)}...` : content,
            type: 'ANNOUNCEMENT',
            link: '/employee/announcements',
            isRead: false,
          })),
        });
      }

      try {
        await prisma.auditLog.create({
          data: {
            userId: session.id,
            role: session.role,
            action: 'ANNOUNCEMENT_CREATED',
            target: createdAnnouncement.id,
            details: JSON.stringify({ code: announcementCode, title }),
          },
        });
      } catch {}

      appEvents.emit(EVENT_TYPES.SYSTEM_ANNOUNCEMENT, { type: 'ANNOUNCEMENT_CREATED', announcement: createdAnnouncement });
      appEvents.emit(EVENT_TYPES.NOTIFICATION_RECEIVED, { announcementId: createdAnnouncement.id });
    }

    revalidatePath('/manager/announcements');
    revalidatePath('/team-lead/announcements');
    revalidatePath('/employee/announcements');
    return {
      success: true,
      message: id ? 'Announcement updated!' : 'Announcement published live!',
      announcement: createdAnnouncement,
      announcementId: id || undefined,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save announcement' };
  }
}

export const createAnnouncementAction = saveAnnouncementAction;

export async function deleteAnnouncementAction(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') return { success: false, error: 'Unauthorized' };

  try {
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        role: session.role,
        action: 'ANNOUNCEMENT_DELETED',
        target: id,
        details: JSON.stringify({ announcementId: id }),
      },
    });
  } catch {}

  await prisma.announcementRead.deleteMany({ where: { announcementId: id } });
  await prisma.announcement.delete({ where: { id } });

  appEvents.emit(EVENT_TYPES.SYSTEM_ANNOUNCEMENT, { type: 'ANNOUNCEMENT_DELETED', announcementId: id });
  revalidatePath('/manager/announcements');
  revalidatePath('/team-lead/announcements');
  revalidatePath('/employee/announcements');
  return { success: true };
}

export async function archiveAnnouncementAction(id: string): Promise<{ success: boolean; error?: string }> {
  return deleteAnnouncementAction(id);
}

export async function markAnnouncementAsReadAction(announcementId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId, userId: session.id } },
    update: { readAt: new Date() },
    create: { announcementId, userId: session.id },
  });
}

export const markAnnouncementReadAction = markAnnouncementAsReadAction;

export async function markAllAnnouncementsAsReadAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const announcements = await prisma.announcement.findMany({ select: { id: true } });
  for (const a of announcements) {
    await prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: a.id, userId: session.id } },
      update: { readAt: new Date() },
      create: { announcementId: a.id, userId: session.id },
    });
  }
}

export async function checkAndPublishScheduledAnnouncements(): Promise<void> {
  // Simplified: announcements are published immediately
}