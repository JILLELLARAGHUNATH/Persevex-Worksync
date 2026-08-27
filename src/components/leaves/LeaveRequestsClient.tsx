'use client';

import React, { useState, useMemo, useEffect } from 'react';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/utils';
import { processLeaveApprovalAction } from '@/actions/leaveActions';
import { Check, X, Loader2, CalendarDays, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function LeaveRequestsClient({
  initialLeaves,
  role,
}: {
  initialLeaves: any[];
  role: 'TEAM_LEAD' | 'MANAGER';
}) {
  const router = useRouter();
  const [leaves, setLeaves] = useState(initialLeaves);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<string>('PENDING');

  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

  // Real-time synchronization
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail?.type === 'LEAVE_STATUS_CHANGED') {
          router.refresh();
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [router]);

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setLoadingId(id);
    const nextStage = action === 'APPROVE' ? (role === 'TEAM_LEAD' ? 'PENDING_MANAGER' : 'APPROVED') : 'REJECTED';

    // Optimistic update
    setLeaves((prev) =>
      prev.map((l) => (l.id === id ? { ...l, currentStage: nextStage } : l))
    );

    const res = await processLeaveApprovalAction(id, action);
    setLoadingId(null);

    if (res.success) {
      toast.success(action === 'APPROVE' ? 'Leave approved successfully!' : 'Leave application rejected.');
      router.refresh();
    } else {
      toast.error(res.error || 'Action failed');
      router.refresh();
    }
  };

  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      if (filterStage === 'PENDING') {
        if (role === 'TEAM_LEAD') return l.currentStage === 'PENDING_TL';
        return l.currentStage === 'PENDING_MANAGER' || l.currentStage === 'PENDING_TL';
      }
      if (filterStage === 'APPROVED') return l.currentStage === 'APPROVED';
      if (filterStage === 'REJECTED') return l.currentStage === 'REJECTED';
      return true; // 'ALL'
    });
  }, [leaves, filterStage, role]);

  const pendingCount = leaves.filter((l) =>
    role === 'TEAM_LEAD' ? l.currentStage === 'PENDING_TL' : l.currentStage === 'PENDING_MANAGER'
  ).length;

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {role === 'MANAGER' ? 'Organization Leave Review' : 'Team Leave Requests'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {pendingCount} pending requests awaiting your action
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          {[
            { key: 'PENDING', label: `Pending (${pendingCount})` },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'REJECTED', label: 'Rejected' },
            { key: 'ALL', label: 'All Requests' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStage(tab.key)}
              className={`px-2.5 py-1 rounded-md transition text-xs cursor-pointer ${
                filterStage === tab.key
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Applicant</th>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Days</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Current Stage</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No leave requests found in this view.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {l.user?.fullName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {l.user?.employeeId} &middot; {l.user?.team?.name || 'No Team'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-violet-600 dark:text-violet-400">
                      {l.leaveType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {formatDate(l.startDate)} &rarr; {formatDate(l.endDate)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {l.daysCount} days
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-500 dark:text-slate-400" title={l.reason}>
                      {l.reason}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={l.currentStage} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(l.currentStage === 'PENDING_TL' && role === 'TEAM_LEAD') ||
                      (l.currentStage === 'PENDING_MANAGER' && role === 'MANAGER') ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            disabled={loadingId === l.id}
                            onClick={() => handleAction(l.id, 'APPROVE')}
                            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 rounded-lg flex items-center gap-1 transition shadow-xs disabled:opacity-50 cursor-pointer text-xs"
                          >
                            {loadingId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button
                            disabled={loadingId === l.id}
                            onClick={() => handleAction(l.id, 'REJECT')}
                            className="h-8 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-medium px-2.5 rounded-lg flex items-center gap-1 transition border border-rose-200 dark:border-rose-800/60 disabled:opacity-50 cursor-pointer text-xs"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No Action Needed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
