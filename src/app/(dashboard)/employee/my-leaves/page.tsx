import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import EmployeeMyLeavesClient from '@/components/leaves/EmployeeMyLeavesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MyLeavesPage() {
  const session = await getSession();
  const leaves = await prisma.leaveRequest.findMany({
    where: { userId: session!.id },
    orderBy: { createdAt: 'desc' },
  });

  return <EmployeeMyLeavesClient initialLeaves={leaves} currentUserId={session!.id} />;
}