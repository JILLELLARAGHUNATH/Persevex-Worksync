import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import EmployeeAnnouncementCenter from '@/components/announcements/EmployeeAnnouncementCenter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TeamLeadAnnouncementsPage() {
  const session = await getSession();
  if (!session) return null;

  const announcements = await prisma.announcement.findMany({
    where: {
      OR: [
        { targetType: 'ALL' },
        { targetType: 'TEAM', targetId: session.teamId || '' },
        { targetType: 'SPECIFIC_EMPLOYEES', targetId: session.id },
      ],
    },
    include: { createdBy: true, reads: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <EmployeeAnnouncementCenter announcements={announcements} currentUserId={session.id} />
    </div>
  );
}