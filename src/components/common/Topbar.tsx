'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, User, Key, LogOut, Sun, Moon, CalendarCheck, Menu, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

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
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;

        if (
          detail.type === 'NOTIFICATION_RECEIVED' ||
          detail.type === 'SYSTEM_ANNOUNCEMENT' ||
          detail.type === 'LEAVE_STATUS_CHANGED' ||
          (detail.payload?.userId && detail.payload.userId === user.id)
        ) {
          fetchNotifications();
        }

        if (detail.type === 'SNAPSHOT_SYNC' && detail.snapshot) {
          if (typeof detail.snapshot.unreadNotificationCount === 'number') {
            setUnreadCount((prev) => {
              if (prev !== detail.snapshot.unreadNotificationCount) {
                fetchNotifications();
                return detail.snapshot.unreadNotificationCount;
              }
              return prev;
            });
          }
        }

        if (detail.type === 'WORKFORCE_UPDATE') {
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
    const interval = setInterval(fetchNotifications, 20000);
    return () => {
      window.removeEventListener('persevex-realtime', handleRealtimeEvent);
      clearInterval(interval);
    };
  }, [user.id]);

  const handleNotificationClick = (notif: any) => {
    setNotifOpen(false);

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

  const initials = currentUser.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const roleLabel = currentUser.role === 'TEAM_LEAD' ? 'Team Lead' : currentUser.role === 'MANAGER' ? 'Manager' : 'Employee';

  return (
    <header className="h-14 bg-white/80 dark:bg-[#0d1424]/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/60 px-4 sm:px-5 flex items-center justify-between sticky top-0 z-30 transition-colors duration-150">

      {/* Left: Mobile menu + mobile logo */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition cursor-pointer"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>

        {/* Mobile brand mark */}
        <Link href="/" className="lg:hidden flex items-center gap-2 shrink-0 focus:outline-none">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
            <Image src="/logo.svg.webp" alt="Persevex" width={16} height={16} priority className="object-contain w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white">WorkSync</span>
        </Link>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/70 transition border border-slate-200 dark:border-slate-700/60 cursor-pointer flex items-center justify-center"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {mounted && isDark ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
          )}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); setDropdownOpen(false); }}
            className="w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition relative cursor-pointer flex items-center justify-center"
            aria-label="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#0d1424]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#0e1628] border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 py-0 z-50 ws-animate-scale-in overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/20">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    Activity Feed
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{unreadCount} unread</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 dark:text-slate-500">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                        !n.isRead
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 opacity-75'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        !n.isRead
                          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        <CalendarCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs truncate ${!n.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                          )}
                        </div>
                        <p className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${!n.isRead ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
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
            onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0">
              {initials}
            </div>
            <div className="text-left hidden sm:block max-w-[120px] overflow-hidden">
              <p className="text-[12px] font-semibold text-slate-900 dark:text-white leading-tight truncate">{currentUser.fullName}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight font-mono truncate">{currentUser.employeeId}</p>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#0e1628] border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 py-1.5 z-50 ws-animate-scale-in overflow-hidden">
              {/* Profile header */}
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60 mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{currentUser.fullName}</p>
                    <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 mt-0.5">
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-slate-400" /> My Profile
              </Link>
              <Link
                href="/change-password"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <Key className="w-3.5 h-3.5 text-slate-400" /> Change Password
              </Link>

              <div className="mt-1 border-t border-slate-100 dark:border-slate-800/60 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}