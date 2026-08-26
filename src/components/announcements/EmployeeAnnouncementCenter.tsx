'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CheckCheck } from 'lucide-react';
import { markAllAnnouncementsAsReadAction } from '@/actions/announcementActions';
import AnnouncementViewModal from './AnnouncementViewModal';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface FeedProps {
  announcements: any[];
  currentUserId: string;
}

export default function EmployeeAnnouncementCenter({ announcements, currentUserId }: FeedProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'IMPORTANT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  // Listen for instant realtime events and immediately refresh feed
  useEffect(() => {
    const handleRealtime = () => {
      router.refresh();
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [router]);

  const filtered = useMemo(() => {
    return announcements.filter((a) => {
      const isRead = a.reads?.some((r: any) => r.userId === currentUserId);
      const isImportant =
        a.priority === 'HIGH' ||
        a.priority === 'URGENT' ||
        a.priority === 'IMPORTANT';

      const matchSearch =
        !search ||
        a.title?.toLowerCase().includes(search.toLowerCase()) ||
        a.content?.toLowerCase().includes(search.toLowerCase());

      const matchCategory = !categoryFilter || a.category?.toUpperCase() === categoryFilter.toUpperCase();

      if (filter === 'UNREAD' && isRead) return false;
      if (filter === 'IMPORTANT' && !isImportant) return false;

      return matchSearch && matchCategory;
    });
  }, [announcements, search, filter, categoryFilter, currentUserId]);

  const unreadCount = announcements.filter((a) => !a.reads?.some((r: any) => r.userId === currentUserId)).length;

  const handleMarkAllRead = async () => {
    await markAllAnnouncementsAsReadAction();
    toast.success('All announcements marked as read.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Announcement Center</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Corporate broadcasts, HR policies, technical updates, and leadership notices
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 bg-slate-100  dark:bg-slate-950 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition border border-slate-200  dark:border-slate-800 dark:border-slate-700"
          >
            <CheckCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Mark All as Read
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm dark:shadow-xl space-y-3 transition-colors duration-200">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                onClick={() => setFilter('ALL')}
                className={'px-3 py-1.5 rounded-xl font-bold transition ' + (filter === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400')}
              >
                All ({announcements.length})
              </button>
              <button
                onClick={() => setFilter('UNREAD')}
                className={'px-3 py-1.5 rounded-xl font-bold transition ' + (filter === 'UNREAD' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400')}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('IMPORTANT')}
                className={'px-3 py-1.5 rounded-xl font-bold transition ' + (filter === 'IMPORTANT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400')}
              >
                Important
              </button>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="">All Categories</option>
              <option value="GENERAL">General</option>
              <option value="IMPORTANT">Important</option>
              <option value="HR_UPDATE">HR Update</option>
              <option value="OFFICE_UPDATE">Office Update</option>
              <option value="POLICY_UPDATE">Policy Update</option>
              <option value="MEETING">Meeting</option>
              <option value="TRAINING">Training</option>
              <option value="EVENT">Event</option>
              <option value="TECHNICAL_UPDATE">Technical</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 rounded-3xl text-center text-slate-400 text-xs shadow-sm">
            No announcements found in this view.
          </div>
        ) : (
          filtered.map((a) => {
            const isRead = a.reads?.some((r: any) => r.userId === currentUserId);
            return (
              <div
                key={a.id}
                onClick={() => setSelectedAnnouncement(a)}
                className={'bg-white dark:bg-slate-900 border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ' + (!isRead ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-800')}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {!isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" title="Unread Notice" />
                    )}
                    <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                      {a.announcementCode || 'ANC'}
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 uppercase">
                      {a.category?.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={'text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ' + (a.priority === 'URGENT' ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30' : a.priority === 'HIGH' || a.priority === 'IMPORTANT' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-slate-100  dark:bg-slate-950 dark:bg-slate-800 text-slate-600 dark:text-slate-400')}
                    >
                      {a.priority} Priority
                    </span>
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    {formatDate(a.publishAt || a.createdAt)}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white">{a.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {a.content}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-[11px] text-slate-400">
                    By <strong className="text-slate-700 dark:text-slate-300">{a.createdBy?.fullName || 'Leadership'}</strong> ({a.createdBy?.role || 'ADMIN'})
                  </span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    View Full Announcement &rarr;
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnnouncementViewModal
        isOpen={!!selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
        announcement={selectedAnnouncement}
      />
    </div>
  );
}
