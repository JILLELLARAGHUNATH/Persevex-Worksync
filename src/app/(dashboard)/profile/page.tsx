import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProfileSettingsClient from '@/components/profile/ProfileSettingsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MyProfilePage() {
  const session = await getSession();
  const profile = await prisma.user.findUnique({
    where: { id: session!.id },
    include: { team: { include: { teamLead: true } } },
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="px-4 py-3 ws-card rounded-xl border-l-4 border-l-slate-500">
        <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Profile & Account Settings</h1>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Manage your personal details, contact information, and security password
        </p>
      </div>

      <ProfileSettingsClient initialProfile={profile} />
    </div>
  );
}