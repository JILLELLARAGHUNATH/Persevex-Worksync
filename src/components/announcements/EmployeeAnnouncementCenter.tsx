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
  const [list, setList] = useState(announcements);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'IMPORTANT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  useEffect(() => {
    setList(announcements);
  }, [announcements]);

  // Listen for instant realtime events and immediately update feed
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail?.type === 'SYSTEM_ANNOUNCEMENT') {
          if (detail.payload?.type === 'ANNOUNCEMENT_CREATED' && detail.payload?.announcement) {
            setList((prev) => [
              detail.payload.announcement,
              ...prev.filter((a) => a.id !== detail.payload.announcement.id),
            ]);
          } else if (detail.payload?.type === 'ANNOUNCEMENT_DELETED' && detail.payload?.announcementId) {
            setList((prev) => prev.filter((a) => a.id !== detail.payload.announcementId));
          }
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [router]);

  const filtered = useMemo(() => {
    return list.filter((a) => {
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
  }, [list, search, filter, categoryFilter, currentUserId]);

  const unreadCount = list.filter((a) => !a.reads?.some((r: any) => r.userId === currentUserId)).length;

  const handleMarkAllRead = async () => {
    setList((prev) =>
      prev.map((a) => ({
        ...a,
        reads: a.reads?.some((r: any) => r.userId === currentUserId)
          ? a.reads
          : [...(a.reads || []), { userId: currentUserId }],
      }))
    );
    await markAllAnnouncementsAsReadAction();
    toast.success('All announcements marked as read.');
  };

  const handleSelectAnnouncement = (a: any) => {
    setSelectedAnnouncement(a);
    setList((prev) =>
      prev.map((item) =>
        item.id === a.id
          ? {
              ...item,
              reads: item.reads?.some((r: any) => r.userId === currentUserId)
                ? item.reads
                : [...(item.reads || []), { userId: currentUserId }],
            }
          : item
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Announcement Center</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Corporate broadcasts, HR policies, technical updates, and leadership notices
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="h-8 flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-3 rounded-lg transition border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Mark All as Read
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 rounded-xl shadow-xs space-y-2.5 transition-colors">
        <div className="flex flex-col md:flex-row gap-2.5 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements..."
              className="w-full h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setFilter('ALL')}
                className={'px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ' + (filter === 'ALL' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200')}
              >
                All ({list.length})
              </button>
              <button
                onClick={() => setFilter('UNREAD')}
                className={'px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ' + (filter === 'UNREAD' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200')}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('IMPORTANT')}
                className={'px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ' + (filter === 'IMPORTANT' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200')}
              >
                Important
              </button>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
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

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-xl text-center text-slate-400 text-xs shadow-xs">
            No announcements found in this view.
          </div>
        ) : (
          filtered.map((a) => {
            const isRead = a.reads?.some((r: any) => r.userId === currentUserId);
            return (
              <div
                key={a.id}
                onClick={() => handleSelectAnnouncement(a)}
                className={'bg-white dark:bg-slate-900 border rounded-xl p-4 sm:p-5 shadow-xs hover:border-blue-400/60 dark:hover:border-blue-600/60 transition-all duration-150 cursor-pointer ' + (!isRead ? 'border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800')}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ring-2 ring-blue-600/20" title="Unread Notice" />
                    )}
                    <span className="font-mono font-semibold text-xs text-blue-600 dark:text-blue-400">
                      {a.announcementCode || 'ANC'}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 uppercase">
                      {a.category?.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={'text-[10px] font-medium px-2 py-0.5 rounded-md uppercase border ' + (
                        a.priority === 'URGENT'
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                          : a.priority === 'HIGH' || a.priority === 'IMPORTANT'
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      )}
                    >
                      {a.priority}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatDate(a.publishAt || a.createdAt)}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">{a.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {a.content}
                </p>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs">
                  <span className="text-[11px] text-slate-400">
                    By <strong className="text-slate-700 dark:text-slate-300 font-medium">{a.createdBy?.fullName || 'Leadership'}</strong>
                  </span>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline">
                    Read More &rarr;
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
