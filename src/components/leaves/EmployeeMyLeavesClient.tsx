'use client';

import React, { useState, useMemo, useEffect } from 'react';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/utils';
import { getTodayIndiaDateKey } from '@/lib/attendanceDate';
import {
  getLeaveFilterDateRange,
  doesLeaveOverlapRange,
  LeaveDatePreset,
} from '@/lib/leaveFilters';
import { CalendarDays, Filter, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface Props {
  initialLeaves: any[];
  currentUserId: string;
}

export default function EmployeeMyLeavesClient({
  initialLeaves,
  currentUserId,
}: Props) {
  const [leaves, setLeaves] = useState<any[]>(initialLeaves);

  // Filter States
  const [datePreset, setDatePreset] = useState<LeaveDatePreset>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIndiaDateKey());
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

  // Real-time synchronization
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;

        if (detail.type === 'LEAVE_STATUS_CHANGED') {
          const type = detail.payload?.type;
          const stage = detail.payload?.stage;
          const leaveId = detail.payload?.leaveId;
          const leaveObj = detail.payload?.leave;

          // Deletion
          if (type === 'LEAVE_DELETED' || stage === 'DELETED') {
            if (leaveId) {
              setLeaves((prev) => prev.filter((l) => l.id !== leaveId));
            }
            return;
          }

          // Added or Updated
          if (leaveObj) {
            // Security check: only process if leave belongs to this employee
            if (leaveObj.userId && leaveObj.userId !== currentUserId) {
              return;
            }

            setLeaves((prev) => {
              const idx = prev.findIndex((l) => l.id === leaveObj.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...leaveObj };
                return copy;
              }
              return [leaveObj, ...prev];
            });
          }
        } else if (detail.type === 'SNAPSHOT_SYNC' && detail.snapshot?.activeLeaveIds) {
          const activeIds = new Set(detail.snapshot.activeLeaveIds);
          setLeaves((prev) => prev.filter((l) => activeIds.has(l.id)));
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [currentUserId]);

  const resetFilters = () => {
    setDatePreset('ALL');
    setSelectedDate(getTodayIndiaDateKey());
    setStatusFilter('');
  };

  const isFilterActive = datePreset !== 'ALL' || Boolean(statusFilter);

  // Filtered leaves calculation using correct date overlap logic
  const filteredLeaves = useMemo(() => {
    const { startRangeKey, endRangeKey } = getLeaveFilterDateRange(datePreset, selectedDate);

    return leaves.filter((l) => {
      // 1. Date Overlap Filter
      if (!doesLeaveOverlapRange(l.startDate, l.endDate, startRangeKey, endRangeKey)) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter) {
        if (statusFilter === 'PENDING') {
          const isPending = l.currentStage === 'PENDING_TL' || l.currentStage === 'PENDING_MANAGER';
          if (!isPending) return false;
        } else if (l.currentStage !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [leaves, datePreset, selectedDate, statusFilter]);

  const pendingCount = leaves.filter((l) => l.currentStage === 'PENDING_TL' || l.currentStage === 'PENDING_MANAGER').length;
  const approvedCount = leaves.filter((l) => l.currentStage === 'APPROVED').length;
  const rejectedCount = leaves.filter((l) => l.currentStage === 'REJECTED').length;

  return (
    <div className="space-y-4">
      {/* Hero Banner */}
      <div className="ws-hero rounded-2xl p-5 sm:p-7">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Leave Management</p>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">My Leave History & Status</h2>
            <p className="text-white/60 text-sm mt-1">Track your leave applications and current status</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Mini stat tiles */}
            <div className="flex items-center gap-2">
              <div className="text-center bg-white/15 border border-white/20 rounded-xl px-3 py-2">
                <div className="text-xl font-black text-white font-mono">{pendingCount}</div>
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Pending</div>
              </div>
              <div className="text-center bg-white/15 border border-white/20 rounded-xl px-3 py-2">
                <div className="text-xl font-black text-white font-mono">{approvedCount}</div>
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Approved</div>
              </div>
              <div className="text-center bg-white/15 border border-white/20 rounded-xl px-3 py-2">
                <div className="text-xl font-black text-white font-mono">{rejectedCount}</div>
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Rejected</div>
              </div>
            </div>
            <Link
              href="/employee/apply-leave"
              className="h-9 bg-white text-indigo-700 hover:bg-indigo-50 font-bold px-4 rounded-xl text-xs flex items-center gap-2 transition shadow-lg cursor-pointer"
            >
              + Apply Leave
            </Link>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="ws-card p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              {(
                [
                  { key: 'ALL', label: 'All Dates' },
                  { key: 'TODAY', label: 'Today' },
                  { key: 'YESTERDAY', label: 'Yesterday' },
                  { key: 'WEEK', label: 'This Week' },
                  { key: 'MONTH', label: 'This Month' },
                  { key: 'DATE', label: 'Select Date' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => setDatePreset(preset.key)}
                  className={`px-2.5 py-1 rounded-md transition text-xs cursor-pointer ${
                    datePreset === preset.key
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Specific Date Picker when DATE preset is chosen */}
            {datePreset === 'DATE' && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Reset Filters */}
          {isFilterActive && (
            <button
              onClick={resetFilters}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer flex items-center gap-1 self-center"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        {/* Status Dropdown and Counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-800 dark:text-slate-200 font-semibold">{filteredLeaves.length}</strong> of {leaves.length} requests
          </div>
        </div>
      </div>

      {/* Leave Requests Cards List */}
      <div className="space-y-3">
        {filteredLeaves.length === 0 ? (
          <div className="ws-card p-8 rounded-xl text-center text-slate-400 text-xs shadow-xs">
            {leaves.length === 0
              ? 'You have not submitted any leave requests yet.'
              : 'No leave requests match your selected filters.'}
          </div>
        ) : (
          filteredLeaves.map((leave) => (
            <div
              key={leave.id}
              className="ws-card p-4 sm:p-5 shadow-xs transition-colors duration-150"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {leave.leaveType.replace(/_/g, ' ')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    {formatDate(leave.startDate)} &rarr; {formatDate(leave.endDate)} ({leave.numberOfDays ?? leave.daysCount ?? 1} Days)
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={leave.currentStage} />
                  {leave.currentStage === 'APPROVED' && (
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        leave.payTreatment === 'PAID'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : leave.payTreatment === 'SPLIT'
                          ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {leave.payTreatment === 'PAID'
                        ? `● Paid (${leave.paidDays ?? leave.numberOfDays}d)`
                        : leave.payTreatment === 'SPLIT'
                        ? `⚡ ${leave.paidDays ?? 0}d Paid + ${leave.unpaidDays ?? 0}d Unpaid`
                        : `○ Unpaid (${leave.unpaidDays ?? leave.numberOfDays}d)`}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 pt-2.5">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Reason:</span> {leave.reason}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
