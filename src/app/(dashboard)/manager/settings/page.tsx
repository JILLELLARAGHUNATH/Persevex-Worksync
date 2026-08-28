import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import OfficeSettingsClient from '@/components/admin/OfficeSettingsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerSettingsPage() {
  const session = await getSession();
  const config = await prisma.systemSetting.findUnique({ where: { id: 'global_config' } });

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Office Location & Policies</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          View and configure the physical office boundary, radius in meters, and shift policies
        </p>
      </div>

      <OfficeSettingsClient initialConfig={config} userRole={session?.role || 'MANAGER'} />
    </div>
  );
}
