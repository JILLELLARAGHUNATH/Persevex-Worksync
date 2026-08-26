import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProfileSettingsClient from '@/components/profile/ProfileSettingsClient';

export default async function MyProfilePage() {
  const session = await getSession();
  const profile = await prisma.user.findUnique({
    where: { id: session!.id },
    include: { team: { include: { teamLead: true } } },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Profile & Account Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your personal details, contact information, and security password
        </p>
      </div>

      <ProfileSettingsClient initialProfile={profile} />
    </div>
  );
}