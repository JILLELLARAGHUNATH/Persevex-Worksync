'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, CalendarCheck, CalendarDays, ShieldAlert, Settings, Building2, UserPlus, X } from 'lucide-react';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const actions = [
    { title: 'Executive Command Center', category: 'Navigation', href: '/admin', icon: ShieldAlert },
    { title: 'Workforce Employee Directory', category: 'Navigation', href: '/admin/employees', icon: Users },
    { title: 'Organization Hierarchy & Squads', category: 'Navigation', href: '/admin/organization', icon: Building2 },
    { title: 'Live Attendance Logs', category: 'Navigation', href: '/admin/attendance', icon: CalendarCheck },
    { title: 'Multi-Level Leave Governance', category: 'Navigation', href: '/admin/leaves', icon: CalendarDays },
    { title: 'System Policies & Office Hours', category: 'Settings', href: '/admin/settings', icon: Settings },
    { title: 'Apply For Leave', category: 'Self-Service', href: '/employee/apply-leave', icon: CalendarDays },
    { title: 'My Attendance History', category: 'Self-Service', href: '/employee/my-attendance', icon: CalendarCheck },
    { title: 'Recruitment Pipeline', category: 'HR Operations', href: '/hr/recruitment', icon: UserPlus },
  ];

  const filtered = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center pt-24 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to view... (ESC to close)"
            className="flex-1 bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none placeholder-slate-400"
          />
          <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/40">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">No matching commands or destinations.</p>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  onClick={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition text-left text-xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition">{item.title}</p>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">{item.category}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 font-mono">Jump &rarr;</span>
                </button>
              );
            })
          )}
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] text-slate-400 font-mono">
          <span>Navigation Quick Key</span>
          <span>Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">ESC</kbd> to exit</span>
        </div>
      </div>
    </div>
  );
}
