'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PersevexLogo from './PersevexLogo';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  FileText,
  Settings,
  Clock,
  Megaphone,
  X,
  Layers,
  FileCheck2
} from 'lucide-react';

interface SidebarProps {
  role: string;
  userName: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ role, userName, isOpenMobile, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const getNavLinks = () => {
    switch (role) {
      case 'MANAGER':
        return [
          { name: 'Dashboard', href: '/manager', icon: LayoutDashboard },
          { name: 'Employees', href: '/manager/employees', icon: Users },
          { name: 'Attendance', href: '/manager/attendance', icon: CalendarCheck },
          { name: 'Teams', href: '/manager/teams', icon: Layers },
          { name: 'Leave Requests', href: '/manager/leave-requests', icon: FileCheck2 },
          { name: 'Announcements', href: '/manager/announcements', icon: Megaphone },
          { name: 'Reports', href: '/manager/reports', icon: FileText },
          { name: 'Settings', href: '/manager/settings', icon: Settings },
        ];
      case 'TEAM_LEAD':
        return [
          { name: 'Dashboard', href: '/team-lead', icon: LayoutDashboard },
          { name: 'Team Members', href: '/team-lead/team-members', icon: Users },
          { name: 'My Attendance', href: '/team-lead/my-attendance', icon: Clock },
          { name: 'Leave Requests', href: '/team-lead/leave-requests', icon: CalendarDays },
          { name: 'Announcements', href: '/team-lead/announcements', icon: Megaphone },
          { name: 'Reports', href: '/team-lead/reports', icon: FileText },
        ];
      default: // EMPLOYEE
        return [
          { name: 'Dashboard', href: '/employee', icon: LayoutDashboard },
          { name: 'My Attendance', href: '/employee/my-attendance', icon: Clock },
          { name: 'Apply Leave', href: '/employee/apply-leave', icon: CalendarDays },
          { name: 'Announcements', href: '/employee/announcements', icon: Megaphone },
          { name: 'Reports', href: '/employee/reports', icon: FileText },
        ];
    }
  };

  const links = getNavLinks();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors">
      <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <Link href="/" className="block focus:outline-none">
          <PersevexLogo size="sm" subtitle={role.replace(/_/g, ' ') + ' Portal'} />
        </Link>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 text-xs">
          {userName.charAt(0)}
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userName}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{role.replace(/_/g, ' ')}</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-30">
        {sidebarContent}
      </aside>

      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={onCloseMobile} />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
