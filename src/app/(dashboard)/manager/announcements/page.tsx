import { prisma } from '@/lib/prisma';
import AnnouncementManagerClient from '@/components/announcements/AnnouncementManagerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerAnnouncementsPage() {
  const [announcements, teams, allEmployees] = await Promise.all([
    prisma.announcement.findMany({
      include: { createdBy: true, reads: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.team.findMany({ where: { isActive: true } }),
    prisma.user.findMany({
      where: { isDeleted: false },
      select: { id: true, fullName: true, employeeId: true },
    }),
  ]);

  return (
    <AnnouncementManagerClient
      initialAnnouncements={announcements}
      teams={teams}
      allEmployees={allEmployees}
      userRole="MANAGER"
    />
  );
}