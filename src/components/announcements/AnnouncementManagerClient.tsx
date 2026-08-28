'use client';

import React, { useState } from 'react';
import { PlusCircle, Search, Trash2, Megaphone, Eye } from 'lucide-react';
import { deleteAnnouncementAction } from '@/actions/announcementActions';
import CreateAnnouncementModal from './CreateAnnouncementModal';
import AnnouncementViewModal from './AnnouncementViewModal';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function AnnouncementManagerClient({
  initialAnnouncements,
  teams,
  allEmployees,
  userRole,
}: {
  initialAnnouncements: any[];
  teams: any[];
  allEmployees: any[];
  totalWorkforceCount?: number;
  userRole: string;
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalAnnouncement, setViewModalAnnouncement] = useState<any | null>(null);

  React.useEffect(() => {
    setAnnouncements(initialAnnouncements);
  }, [initialAnnouncements]);

  React.useEffect(() => {
    const handleRealtime = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'SYSTEM_ANNOUNCEMENT') {
        if (detail.payload?.type === 'ANNOUNCEMENT_CREATED' && detail.payload?.announcement) {
          setAnnouncements((prev) => [detail.payload.announcement, ...prev.filter((a) => a.id !== detail.payload.announcement.id)]);
        } else if (detail.payload?.type === 'ANNOUNCEMENT_DELETED' && detail.payload?.announcementId) {
          setAnnouncements((prev) => prev.filter((a) => a.id !== detail.payload.announcementId));
        }
      }
    };
    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, []);

  const filtered = announcements.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    const res = await deleteAnnouncementAction(id);
    if (res.success) {
      toast.success('Announcement deleted.');
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Announcements</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Broadcast updates to all employees, specific teams, or individuals
          </p>
        </div>

        {userRole === 'MANAGER' && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Create Announcement
          </button>
        )}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-xl text-center text-slate-400 text-xs shadow-xs">
            No announcements broadcasted yet.
          </div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs transition-colors space-y-2.5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-xs text-blue-600 dark:text-blue-400">
                    {a.announcementCode || 'ANC'}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md uppercase border ${
                    a.priority === 'URGENT'
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                      : a.priority === 'IMPORTANT'
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}>
                    {a.priority}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    Target: {a.targetType.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewModalAnnouncement(a)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="View"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {userRole === 'MANAGER' && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">{a.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{a.content}</p>

              <div className="pt-1 text-[11px] text-slate-400 font-mono">
                Published {formatDate(a.createdAt)} by {a.createdBy?.fullName || 'Management'}
              </div>
            </div>
          ))
        )}
      </div>

      <CreateAnnouncementModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        teams={teams}
        allEmployees={allEmployees}
      />

      <AnnouncementViewModal
        isOpen={!!viewModalAnnouncement}
        onClose={() => setViewModalAnnouncement(null)}
        announcement={viewModalAnnouncement}
      />
    </div>
  );
}