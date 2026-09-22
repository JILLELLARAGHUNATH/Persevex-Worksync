'use client';

import React, { useState, useRef } from 'react';
import { CalendarPlus, Clock, X, History, Send, Loader2 } from 'lucide-react';
import { applyLeaveAction } from '@/actions/leaveActions';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function ApplyLeaveClient({ history }: { balances?: any[]; history: any[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [leaveHistory, setLeaveHistory] = useState(history);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isPending, startTransition] = React.useTransition();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);

  React.useEffect(() => {
    setLeaveHistory(history);
  }, [history]);

  React.useEffect(() => {
    const handleRealtime = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      if (detail.type === 'LEAVE_STATUS_CHANGED') {
        const type = detail.payload?.type;
        const stage = detail.payload?.stage;
        const leaveId = detail.payload?.leaveId;

        if (type === 'LEAVE_DELETED' || stage === 'DELETED') {
          if (leaveId) {
            setLeaveHistory((prev) => prev.filter((l) => l.id !== leaveId));
          }
          return;
        }

        const updated = detail.payload?.leave;
        if (updated) {
          setLeaveHistory((prev) => {
            const idx = prev.findIndex((l) => l.id === updated.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...updated };
              return copy;
            }
            return [updated, ...prev];
          });
        }
      } else if (detail.type === 'SNAPSHOT_SYNC' && detail.snapshot?.activeLeaveIds) {
        const activeIds = new Set(detail.snapshot.activeLeaveIds);
        setLeaveHistory((prev) => prev.filter((l) => activeIds.has(l.id)));
      }
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, []);

  const filteredHistory = leaveHistory.filter((h) => {
    if (statusFilter !== 'ALL' && h.currentStage !== statusFilter) return false;
    return true;
  });

  const isSingleDay = Boolean(startDate && endDate && startDate === endDate);

  const handleSubmit = (formData: FormData) => {
    if (isSingleDay && isHalfDay) {
      formData.set('isHalfDay', 'true');
    }
    startTransition(async () => {
      const res = await applyLeaveAction(formData);
      if (res?.success) {
        toast.success(res.message || 'Leave application submitted successfully!');
        formRef.current?.reset();
        setStartDate('');
        setEndDate('');
        setIsHalfDay(false);
        if (res.leave) {
          setLeaveHistory((prev) => [res.leave, ...prev.filter((l) => l.id !== res.leave.id)]);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('persevex-realtime', {
                detail: {
                  type: 'LEAVE_STATUS_CHANGED',
                  payload: {
                    leaveId: res.leave.id,
                    stage: res.leave.currentStage,
                    leave: res.leave,
                  },
                },
              })
            );
          }
        }
      } else {
        toast.error(res?.error || 'Failed to submit leave request');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex justify-end">
        <button
          onClick={() => setHistoryOpen(true)}
          className="h-8 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium px-3 rounded-lg text-xs flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer"
        >
          <History className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          Leave History ({history.length})
        </button>
      </div>

      {/* Clean Apply Leave Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-xl shadow-xs space-y-4 max-w-2xl transition-colors">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60">
            <CalendarPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Submit Leave Request
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Fill in absence dates and reason</p>
          </div>
        </div>

        {/* Policy Notice */}
        <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-center justify-between">
          <span>✨ <strong>Monthly Paid Leave Entitlement:</strong> 1.5 paid days/month for full-time members (resets fresh on 1st of every month).</span>
        </div>

        <form ref={formRef} action={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Leave Type *</label>
            <select name="leaveType" className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="PAID">Paid Annual Leave</option>
              <option value="WORK_FROM_HOME">Work From Home</option>
              <option value="EMERGENCY">Emergency Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">From Date *</label>
              <input
                type="date"
                name="startDate"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate) setEndDate(e.target.value);
                }}
                required
                className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">To Date *</label>
              <input
                type="date"
                name="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Single Day Half Day Selector */}
          {isSingleDay && (
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Duration Type:
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dayOption"
                    checked={!isHalfDay}
                    onChange={() => setIsHalfDay(false)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">Full Day (1.0d)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dayOption"
                    checked={isHalfDay}
                    onChange={() => setIsHalfDay(true)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">Half Day (0.5d)</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Reason for Absence *</label>
            <textarea
              name="reason"
              required
              rows={3}
              placeholder="State the reason for this leave request..."
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition shadow-xs text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Submit Application
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Leave History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-5 shadow-xl space-y-3.5 transition-colors">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">My Leave History</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">All submitted requests</p>
                </div>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_TL">Pending Team Lead</option>
                <option value="PENDING_MANAGER">Pending Manager</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/50 uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3.5">Type</th>
                    <th className="py-2.5 px-3.5">Dates</th>
                    <th className="py-2.5 px-3.5">Days</th>
                    <th className="py-2.5 px-3.5">Reason</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5">Applied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">No leave records found.</td>
                    </tr>
                  ) : (
                    filteredHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3.5 font-semibold text-slate-900 dark:text-slate-100">{h.leaveType.replace(/_/g, ' ')}</td>
                        <td className="py-2.5 px-3.5 font-mono text-slate-600 dark:text-slate-400">{formatDate(h.startDate)} &rarr; {formatDate(h.endDate)}</td>
                        <td className="py-2.5 px-3.5 font-mono font-semibold text-violet-600 dark:text-violet-400">{h.numberOfDays}d</td>
                        <td className="py-2.5 px-3.5 max-w-xs truncate">{h.reason}</td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={h.currentStage} />
                            {h.currentStage === 'APPROVED' && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  h.payTreatment === 'PAID'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : h.payTreatment === 'SPLIT'
                                    ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                }`}
                              >
                                {h.payTreatment === 'PAID'
                                  ? `● Paid (${h.paidDays ?? h.numberOfDays}d)`
                                  : h.payTreatment === 'SPLIT'
                                  ? `⚡ ${h.paidDays ?? 0}d Paid + ${h.unpaidDays ?? 0}d Unpaid`
                                  : `○ Unpaid (${h.unpaidDays ?? h.numberOfDays}d)`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-slate-400">{formatDate(h.createdAt)}</td>
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
