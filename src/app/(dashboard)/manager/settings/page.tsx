import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import OfficeSettingsClient from '@/components/admin/OfficeSettingsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerSettingsPage() {
  const session = await getSession();
  const config = await prisma.systemSetting.findUnique({ where: { id: 'global_config' } });

  return (
    <div className="space-y-3 max-w-4xl">
      <div className="px-4 py-3 ws-card rounded-xl border-l-4 border-l-slate-500">
        <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Office Location &amp; Policies</h1>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">View and configure the physical office boundary, radius in meters, and shift policies</p>
      </div>

      <OfficeSettingsClient initialConfig={config} userRole={session?.role || 'MANAGER'} />
    </div>
  );
}
