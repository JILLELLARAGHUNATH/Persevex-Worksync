'use client';

import { useEffect } from 'react';
import { X, Paperclip, CheckCircle2 } from 'lucide-react';
import { markAnnouncementAsReadAction } from '@/actions/announcementActions';
import { formatDate } from '@/lib/utils';

interface ViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: any | null;
}

export default function AnnouncementViewModal({ isOpen, onClose, announcement }: ViewModalProps) {
  useEffect(() => {
    if (isOpen && announcement?.id) {
      markAnnouncementAsReadAction(announcement.id);
    }
  }, [isOpen, announcement]);

  if (!isOpen || !announcement) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150 space-y-5 transition-colors">
        <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                {announcement.announcementCode || 'ANNOUNCEMENT'}
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                  announcement.priority === 'URGENT'
                    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 animate-pulse'
                    : announcement.priority === 'HIGH'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-slate-100  dark:bg-slate-950 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {announcement.priority} PRIORITY
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase">
                {announcement.category?.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {announcement.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100  dark:hover:bg-slate-800  dark:bg-slate-950 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200  dark:border-slate-800/80 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-semibold uppercase">Announced By</span>
            <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {announcement.createdBy?.fullName || 'Leadership Team'}
            </p>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
              ({announcement.createdBy?.role || 'ADMIN'})
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-semibold uppercase">Published Date</span>
            <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
              {formatDate(announcement.publishAt || announcement.createdAt)}
            </p>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-semibold uppercase">Target Audience</span>
            <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 capitalize">
              {announcement.targetType?.replace(/_/g, ' ') || 'All Employees'}
            </p>
          </div>
        </div>

        <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed py-2">
          {announcement.content}
        </div>

        {announcement.attachmentUrl && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {announcement.attachmentName || 'Supporting Attachment'}
              </span>
            </div>
            <a
              href={announcement.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Download File &rarr;
            </a>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-semibold text-[11px]">
            <CheckCircle2 className="w-4 h-4" /> Marked as read
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100  dark:bg-slate-950 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}