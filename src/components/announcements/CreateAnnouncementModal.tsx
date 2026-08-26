'use client';

import React, { useState, useEffect } from 'react';
import { X, Megaphone, Send, Loader2 } from 'lucide-react';
import { saveAnnouncementAction } from '@/actions/announcementActions';
import { toast } from 'sonner';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcementData?: any | null;
  teams: any[];
  allEmployees: any[];
}

export default function CreateAnnouncementModal({
  isOpen,
  onClose,
  announcementData,
  teams,
  allEmployees,
}: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [targetType, setTargetType] = useState('ALL');
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (announcementData) {
      setTitle(announcementData.title || '');
      setContent(announcementData.content || '');
      setPriority(announcementData.priority || 'NORMAL');
      setTargetType(announcementData.targetType || 'ALL');
      setTargetId(announcementData.targetId || '');
    } else {
      setTitle('');
      setContent('');
      setPriority('NORMAL');
      setTargetType('ALL');
      setTargetId('');
    }
  }, [announcementData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Title and message content are required.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    if (announcementData?.id) formData.set('id', announcementData.id);
    formData.set('title', title);
    formData.set('content', content);
    formData.set('priority', priority);
    formData.set('targetType', targetType);
    formData.set('targetId', targetId);

    const res = await saveAnnouncementAction(formData);
    setLoading(false);

    if (res.success) {
      toast.success(res.message || 'Announcement published!');
      onClose();
    } else {
      toast.error(res.error || 'Failed to publish announcement.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 transition-colors">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {announcementData ? 'Edit Announcement' : 'Broadcast Announcement'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Reach the entire team or targeted groups</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Office Timing Update / Sprint Milestone"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-indigo-500 font-medium text-sm"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Message Content *</label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the full announcement here..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-bold"
              >
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">Important</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Audience</label>
              <select
                value={targetType}
                onChange={(e) => {
                  setTargetType(e.target.value);
                  setTargetId('');
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-semibold text-indigo-600 dark:text-indigo-400"
              >
                <option value="ALL">All Employees</option>
                <option value="TEAM">Specific Team</option>
                <option value="SPECIFIC_EMPLOYEES">Specific Employee</option>
              </select>
            </div>
          </div>

          {targetType === 'TEAM' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Select Target Team *</label>
              <select
                required
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium"
              >
                <option value="">Choose Team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'SPECIFIC_EMPLOYEES' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Select Target Employee *</label>
              <select
                required
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium"
              >
                <option value="">Choose Employee</option>
                {allEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeId})</option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publish Announcement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}