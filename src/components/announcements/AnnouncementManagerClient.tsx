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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Announcements</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Broadcast updates to all employees, specific teams, or individuals
          </p>
        </div>

        {userRole === 'MANAGER' && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <PlusCircle className="w-4 h-4" /> + New Announcement
          </button>
        )}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 rounded-3xl text-center text-slate-400 text-xs shadow-sm">
            No announcements broadcasted yet.
          </div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl transition-colors space-y-3"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                    {a.announcementCode || 'ANC'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 uppercase">
                    {a.priority}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    Target: {a.targetType.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewModalAnnouncement(a)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {userRole === 'MANAGER' && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{a.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{a.content}</p>

              <div className="pt-2 text-[11px] text-slate-400 font-mono">
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