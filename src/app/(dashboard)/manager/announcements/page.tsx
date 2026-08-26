import { prisma } from '@/lib/prisma';
import AnnouncementManagerClient from '@/components/announcements/AnnouncementManagerClient';

export default async function ManagerAnnouncementsPage() {
  const announcements = await prisma.announcement.findMany({
    include: { createdBy: true, reads: true },
    orderBy: { createdAt: 'desc' },
  });

  const teams = await prisma.team.findMany({ where: { isActive: true } });
  const allEmployees = await prisma.user.findMany({
    where: { isDeleted: false },
    select: { id: true, fullName: true, employeeId: true },
  });

  return (
    <AnnouncementManagerClient
      initialAnnouncements={announcements}
      teams={teams}
      allEmployees={allEmployees}
      userRole="MANAGER"
    />
  );
}