'use client';

import React, { useState, useMemo, useEffect } from 'react';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate, getIndiaDateKey } from '@/lib/utils';
import { getTodayIndiaDateKey } from '@/lib/attendanceDate';
import {
  getLeaveFilterDateRange,
  doesLeaveOverlapRange,
  LeaveDatePreset,
} from '@/lib/leaveFilters';
import { processLeaveApprovalAction } from '@/actions/leaveActions';
import {
  Check,
  X,
  Loader2,
  CalendarDays,
  Filter,
  RotateCcw,
  Users,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Props {
  initialLeaves: any[];
  initialTeams?: any[];
  initialEmployees?: any[];
  role: 'TEAM_LEAD' | 'MANAGER';
}

export default function LeaveRequestsClient({
  initialLeaves,
  initialTeams = [],
  initialEmployees = [],
  role,
}: Props) {
  const router = useRouter();
  const [leaves, setLeaves] = useState<any[]>(initialLeaves);
  const [teams, setTeams] = useState<any[]>(initialTeams);
  const [employees, setEmployees] = useState<any[]>(initialEmployees);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Top Tabs: PENDING | APPROVED | REJECTED | ALL
  const [filterStage, setFilterStage] = useState<string>('PENDING');

  // Advanced Filters (active when filterStage === 'ALL')
  const [datePreset, setDatePreset] = useState<LeaveDatePreset>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIndiaDateKey());
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

  useEffect(() => {
    if (initialTeams.length > 0) setTeams(initialTeams);
  }, [initialTeams]);

  useEffect(() => {
    if (initialEmployees.length > 0) setEmployees(initialEmployees);
  }, [initialEmployees]);

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

          if (type === 'LEAVE_DELETED' || stage === 'DELETED') {
            if (leaveId) {
              setLeaves((prev) => prev.filter((l) => l.id !== leaveId));
            }
            return;
          }

          if (detail.payload?.leave) {
            const updated = detail.payload.leave;
            setLeaves((prev) => {
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
          setLeaves((prev) => prev.filter((l) => activeIds.has(l.id)));
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
      if (res.leave) {
        setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, ...res.leave } : l)));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('persevex-realtime', {
            detail: {
              type: 'LEAVE_STATUS_CHANGED',
              payload: {
                leaveId: id,
                stage: nextStage,
                leave: res.leave || { id, currentStage: nextStage },
              },
            },
          })
        );
      }
      router.refresh();
    } else {
      toast.error(res.error || 'Action failed');
      router.refresh();
    }
  };

  // Available employees for dropdown (filtered by selectedTeam if Manager selected a team)
  const availableEmployeesForDropdown = useMemo(() => {
    if (role === 'TEAM_LEAD') {
      // In Team Lead mode, strictly return assigned squad members
      return employees;
    }
    if (selectedTeam) {
      return employees.filter((e) => e.teamId === selectedTeam);
    }
    return employees;
  }, [employees, selectedTeam, role]);

  // Handle Team change with automatic employee reset if needed
  const handleTeamChange = (newTeamId: string) => {
    setSelectedTeam(newTeamId);
    if (selectedEmployee) {
      const currentEmp = employees.find((e) => e.id === selectedEmployee);
      if (currentEmp && newTeamId && currentEmp.teamId !== newTeamId) {
        setSelectedEmployee('');
      }
    }
  };

  // Reset all advanced filters
  const resetFilters = () => {
    setDatePreset('ALL');
    setSelectedDate(getTodayIndiaDateKey());
    setSelectedTeam('');
    setSelectedEmployee('');
    setStatusFilter('');
  };

  // Filtered leaves calculation
  const filteredLeaves = useMemo(() => {
    // 1. If tab is Pending, Approved, or Rejected -> strict clean tab filtering
    if (filterStage === 'PENDING') {
      return leaves.filter((l) =>
        role === 'TEAM_LEAD' ? l.currentStage === 'PENDING_TL' : (l.currentStage === 'PENDING_MANAGER' || l.currentStage === 'PENDING_TL')
      );
    }
    if (filterStage === 'APPROVED') {
      return leaves.filter((l) => l.currentStage === 'APPROVED');
    }
    if (filterStage === 'REJECTED') {
      return leaves.filter((l) => l.currentStage === 'REJECTED');
    }

    // 2. Tab is 'ALL' -> Apply advanced combined filters
    const { startRangeKey, endRangeKey } = getLeaveFilterDateRange(datePreset, selectedDate);

    return leaves.filter((l) => {
      // A. Date Overlap Filter
      if (!doesLeaveOverlapRange(l.startDate, l.endDate, startRangeKey, endRangeKey)) {
        return false;
      }

      // B. Team Filter (Manager only)
      if (role === 'MANAGER' && selectedTeam) {
        const leaveTeamId = l.user?.teamId || l.user?.team?.id;
        if (leaveTeamId !== selectedTeam) return false;
      }

      // C. Employee Filter
      if (selectedEmployee && l.userId !== selectedEmployee) {
        return false;
      }

      // D. Status Filter inside All Requests
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
  }, [leaves, filterStage, role, datePreset, selectedDate, selectedTeam, selectedEmployee, statusFilter]);

  const pendingCount = leaves.filter((l) =>
    role === 'TEAM_LEAD' ? l.currentStage === 'PENDING_TL' : (l.currentStage === 'PENDING_MANAGER' || l.currentStage === 'PENDING_TL')
  ).length;

  const isFilterActive =
    datePreset !== 'ALL' ||
    Boolean(selectedTeam) ||
    Boolean(selectedEmployee) ||
    Boolean(statusFilter);

  return (
    <div className="space-y-4">
      {/* Top Bar: Title & Top-level Tabs */}
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

      {/* Advanced Filters Panel (Shown ONLY when "All Requests" is selected) */}
      {filterStage === 'ALL' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs space-y-3 transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Date Range Presets */}
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

            {/* Reset Filters Action */}
            {isFilterActive && (
              <button
                onClick={resetFilters}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer flex items-center gap-1 self-center"
              >
                <RotateCcw className="w-3 h-3" /> Reset Filters
              </button>
            )}
          </div>

          {/* Select Dropdowns: Team (Manager), Employee (All / Squad), Status */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            {/* Team Filter (Manager only) */}
            {role === 'MANAGER' && (
              <div className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedTeam}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="">All Teams</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Employee Filter */}
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="">
                  {role === 'TEAM_LEAD' ? 'All Assigned Employees' : 'All Employees'}
                </option>
                {availableEmployeesForDropdown.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.employeeId || 'ID'})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter inside All Requests */}
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

            {/* Counter pill */}
            <div className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
              Showing <strong className="text-slate-800 dark:text-slate-200 font-semibold">{filteredLeaves.length}</strong> of {leaves.length} requests
            </div>
          </div>
        </div>
      )}

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
                    No leave requests found matching the current criteria.
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
                      {l.numberOfDays ?? l.daysCount ?? 1} days
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

