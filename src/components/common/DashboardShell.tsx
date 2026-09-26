'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import RealtimeListener from './RealtimeListener';
import CommandPalette from './CommandPalette';

export default function DashboardShell({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen ws-page-bg text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <RealtimeListener />
      <CommandPalette />

      <Sidebar
        role={user.role}
        userName={user.fullName}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}