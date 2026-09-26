import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import ApplyLeaveClient from '@/components/leaves/ApplyLeaveClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ApplyLeavePage() {
  const session = await getSession();

  const [balances, history] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId: session!.id, year: new Date().getFullYear() },
    }),
    prisma.leaveRequest.findMany({
      where: { userId: session!.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div className="max-w-4xl">
      <ApplyLeaveClient balances={balances} history={history} />
    </div>
  );
}
