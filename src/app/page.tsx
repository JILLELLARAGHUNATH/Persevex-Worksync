import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function RootPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role === 'MANAGER') redirect('/manager');
  if (session.role === 'TEAM_LEAD') redirect('/team-lead');
  redirect('/employee');
}
