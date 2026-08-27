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
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 sm:p-6 shadow-xl animate-in zoom-in-95 duration-150 space-y-4 transition-colors">
        <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="font-mono font-semibold text-xs text-blue-600 dark:text-blue-400">
                {announcement.announcementCode || 'ANNOUNCEMENT'}
              </span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-md uppercase border ${
                  announcement.priority === 'URGENT'
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                    : announcement.priority === 'HIGH' || announcement.priority === 'IMPORTANT'
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {announcement.priority}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 uppercase">
                {announcement.category?.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {announcement.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium uppercase">Announced By</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {announcement.createdBy?.fullName || 'Leadership Team'}
            </p>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
              ({announcement.createdBy?.role || 'ADMIN'})
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium uppercase">Published Date</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
              {formatDate(announcement.publishAt || announcement.createdAt)}
            </p>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium uppercase">Target Audience</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 capitalize">
              {announcement.targetType?.replace(/_/g, ' ') || 'All Employees'}
            </p>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed py-1">
          {announcement.content}
        </div>

        {announcement.attachmentUrl && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Paperclip className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {announcement.attachmentName || 'Supporting Attachment'}
              </span>
            </div>
            <a
              href={announcement.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Download File &rarr;
            </a>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" /> Marked as read
          </span>
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}