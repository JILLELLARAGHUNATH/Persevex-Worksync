'use client';

import React, { useState } from 'react';
import { CalendarPlus, Clock, X, History, Send, Loader2 } from 'lucide-react';
import { applyLeaveAction } from '@/actions/leaveActions';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/utils';

export default function ApplyLeaveClient({ history }: { balances?: any[]; history: any[] }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredHistory = history.filter((h) => {
    if (statusFilter !== 'ALL' && h.currentStage !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex justify-end">
        <button
          onClick={() => setHistoryOpen(true)}
          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition border border-slate-200 dark:border-slate-700"
        >
          <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          View Leave History ({history.length})
        </button>
      </div>

      {/* Simplified Clean Apply Leave Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-5 transition-colors">
        <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
          <CalendarPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Submit Leave Request
        </h3>

        <form action={applyLeaveAction} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Leave Type *</label>
            <select name="leaveType" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium">
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="PAID">Paid Annual Leave</option>
              <option value="WORK_FROM_HOME">Work From Home</option>
              <option value="EMERGENCY">Emergency Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">From Date *</label>
              <input type="date" name="startDate" required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono" />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">To Date *</label>
              <input type="date" name="endDate" required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Reason for Absence *</label>
            <textarea
              name="reason"
              required
              rows={3}
              placeholder="State the reason for this leave request..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition shadow-md shadow-indigo-600/20 text-xs flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Submit Application
          </button>
        </form>
      </div>

      {/* Leave History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">My Leave History</h3>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_TL">Pending Team Lead</option>
                <option value="PENDING_MANAGER">Pending Manager</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-950/80 uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Dates</th>
                    <th className="p-3.5">Days</th>
                    <th className="p-3.5">Reason</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Applied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">No leave records found.</td>
                    </tr>
                  ) : (
                    filteredHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">{h.leaveType.replace(/_/g, ' ')}</td>
                        <td className="p-3.5 font-mono">{formatDate(h.startDate)} &rarr; {formatDate(h.endDate)}</td>
                        <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{h.numberOfDays}d</td>
                        <td className="p-3.5 max-w-xs truncate">{h.reason}</td>
                        <td className="p-3.5"><StatusBadge status={h.currentStage} /></td>
                        <td className="p-3.5 font-mono text-slate-400">{formatDate(h.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
