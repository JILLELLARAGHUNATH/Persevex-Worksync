'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, User, Key, LogOut, Sun, Moon, CalendarCheck, Menu } from 'lucide-react';
import { toast } from 'sonner';
import PersevexLogo from './PersevexLogo';


interface TopbarProps {
  user: {
    id: string;
    fullName: string;
    role: string;
    employeeId: string;
  };
  onOpenMobileMenu?: () => void;
}

export default function Topbar({ user, onOpenMobileMenu }: TopbarProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(user);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    setMounted(true);
    if (typeof document !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
        setIsDark(false);
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
        setIsDark(true);
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleTheme = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const currentlyDark = root.classList.contains('dark');
    if (currentlyDark) {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      try { localStorage.setItem('theme', 'light'); } catch { }
      setIsDark(false);
    } else {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      try { localStorage.setItem('theme', 'dark'); } catch { }
      setIsDark(true);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch { }
  };

  useEffect(() => {
    fetchNotifications();
    const handleRealtimeEvent = (e: Event) => {
      fetchNotifications();
      try {
        const detail = (e as CustomEvent).detail;
        if (detail?.type === 'WORKFORCE_UPDATE') {
          const updatedUser = detail.payload?.user;
          if (updatedUser && updatedUser.id === user.id) {
            setCurrentUser((prev) => ({
              ...prev,
              fullName: updatedUser.fullName,
              email: updatedUser.email,
              role: updatedUser.role || prev.role,
            }));
          }
        }
      } catch {}
    };
    window.addEventListener('persevex-realtime', handleRealtimeEvent);
    const interval = setInterval(fetchNotifications, 15000);
    return () => {
      window.removeEventListener('persevex-realtime', handleRealtimeEvent);
      clearInterval(interval);
    };
  }, [user.id]);

  const handleNotificationClick = (notif: any) => {
    setNotifOpen(false);
    
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
    if (!notif.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: notif.id }),
    }).catch(() => {});

    if (notif.link) router.push(notif.link);
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'ALL' }),
    }).catch(() => {});
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Logged out successfully');
      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  return (
    <header className="h-14 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors duration-150">

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/" className="lg:hidden flex items-center shrink-0 focus:outline-none">
          <PersevexLogo size="sm" showWorkSyncTag={true} contained={true} className="!items-start" />
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:white transition border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {mounted && isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-blue-600" />
          )}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setDropdownOpen(false);
            }}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition relative cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-50 animate-in fade-in duration-100">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Activity Feed</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{unreadCount} unread updates</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {notifications.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">No new notifications.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 transition flex items-start gap-2.5 cursor-pointer ${
                        !n.isRead
                          ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-80'
                      }`}
                    >
                      <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${
                        !n.isRead
                          ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        <CalendarCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs truncate ${!n.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                          )}
                        </div>
                        <p className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${!n.isRead ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs text-white shadow-xs">
              {currentUser.fullName.charAt(0)}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">{currentUser.fullName}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight font-mono">{currentUser.employeeId}</p>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in duration-100">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{currentUser.fullName}</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono capitalize">{currentUser.role.toLowerCase().replace(/_/g, ' ')}</p>
              </div>
              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <User className="w-3.5 h-3.5 text-slate-400" /> My Profile
              </Link>
              <Link
                href="/change-password"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Key className="w-3.5 h-3.5 text-slate-400" /> Change Password
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition mt-1 border-t border-slate-100 dark:border-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}