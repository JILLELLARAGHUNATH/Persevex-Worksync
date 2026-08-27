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
    <div className="flex flex-col h-full bg-[#16243A] border-r border-[#223450] transition-colors">
      <div className="p-4 flex items-center justify-between border-b border-[#223450]">
        <Link href="/" className="block focus:outline-none">
          <PersevexLogo size="sm" showWorkSyncTag={true} subtitle={role.replace(/_/g, ' ') + ' PORTAL'} className="!items-start" />
        </Link>

        {onCloseMobile && (
          <button onClick={onCloseMobile} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 relative ${
                isActive
                  ? 'bg-blue-600/15 text-white font-semibold shadow-xs before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-blue-500 before:rounded-r'
                  : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3.5 border-t border-[#223450] bg-[#101B2B] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0 shadow-xs">
          {userName.charAt(0)}
        </div>
        <div className="overflow-hidden min-w-0">
          <p className="text-xs font-semibold text-slate-100 truncate">{userName}</p>
          <p className="text-[10px] text-slate-400 truncate capitalize">{role.toLowerCase().replace(/_/g, ' ')}</p>
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
