'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Calendar,
  FileText,
  Settings,
  Clock,
  Megaphone,
  X,
  Layers,
  FileCheck2,
  Banknote
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
          { name: 'Work Calendar', href: '/manager/work-calendar', icon: Calendar },
          { name: 'Salary & Payroll', href: '/manager/salary-payroll', icon: Banknote },
          { name: 'Announcements', href: '/manager/announcements', icon: Megaphone },
          { name: 'Reports', href: '/manager/reports', icon: FileText },
          { name: 'Settings', href: '/manager/settings', icon: Settings },
        ];
      case 'TEAM_LEAD':
        return [
          { name: 'Dashboard', href: '/team-lead', icon: LayoutDashboard },
          { name: 'Team Members', href: '/team-lead/team-members', icon: Users },
          { name: 'My Attendance', href: '/team-lead/my-attendance', icon: Clock },
          { name: 'Apply Leave', href: '/team-lead/apply-leave', icon: CalendarDays },
          { name: 'Leave Requests', href: '/team-lead/leave-requests', icon: FileCheck2 },
          { name: 'Work Calendar', href: '/team-lead/work-calendar', icon: Calendar },
          { name: 'Announcements', href: '/team-lead/announcements', icon: Megaphone },
          { name: 'Reports', href: '/team-lead/reports', icon: FileText },
        ];
      default: // EMPLOYEE
        return [
          { name: 'Dashboard', href: '/employee', icon: LayoutDashboard },
          { name: 'My Attendance', href: '/employee/my-attendance', icon: Clock },
          { name: 'Apply Leave', href: '/employee/apply-leave', icon: CalendarDays },
          { name: 'Work Calendar', href: '/employee/work-calendar', icon: Calendar },
          { name: 'Announcements', href: '/employee/announcements', icon: Megaphone },
          { name: 'Reports', href: '/employee/reports', icon: FileText },
        ];
    }
  };

  const links = getNavLinks();
  const initials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const roleLabel = role === 'TEAM_LEAD' ? 'Team Lead' : role === 'MANAGER' ? 'Manager' : 'Employee';

  const sidebarContent = (
    <div
      className="flex flex-col h-full border-r border-white/5 transition-colors"
      style={{
        background: 'linear-gradient(180deg, #0d1424 0%, #111230 60%, #12103a 100%)',
      }}
    >
      {/* ── Logo / Brand ── */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-white/[0.06]">
        <Link href="/" className="block focus:outline-none min-w-0 flex-1 group">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/40">
              <Image
                src="/logo.svg.webp"
                alt="Persevex"
                width={20}
                height={20}
                priority
                className="object-contain w-5 h-5"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white leading-tight tracking-tight">WorkSync</p>
              <p className="text-[9px] font-semibold text-indigo-400/80 tracking-widest uppercase leading-tight mt-0.5">
                {roleLabel} Portal
              </p>
            </div>
          </div>
        </Link>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 ml-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            aria-label="Close Navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={true}
              onClick={onCloseMobile}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                transition-all duration-200 group
                ${isActive
                  ? 'bg-indigo-500/15 text-white font-semibold'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                }
              `}
            >
              {/* Active left accent bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
              )}

              <span className={`
                w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors duration-200
                ${isActive
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-500 group-hover:text-slate-300'
                }
              `}>
                <Icon className="w-4 h-4" />
              </span>

              <span className="truncate">{link.name}</span>

              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User Footer ── */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors duration-200">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d1424]" />
          </div>
          <div className="overflow-hidden min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-slate-100 truncate">{userName}</p>
            <p className="text-[10px] text-slate-500 truncate">{roleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-60 h-screen sticky top-0 shrink-0 z-30">
        {sidebarContent}
      </aside>

      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-60 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
