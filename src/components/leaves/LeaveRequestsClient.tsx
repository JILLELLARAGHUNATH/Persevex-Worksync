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
import { processLeaveApprovalAction, getLeaveRequestEntitlementPreviewAction } from '@/actions/leaveActions';
import {
  Check,
  X,
  Loader2,
  CalendarDays,
  Filter,
  RotateCcw,
  Users,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  Calendar,
  ShieldAlert,
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
  
  // Manager Approval Modal States
  const [approvalModalLeave, setApprovalModalLeave] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [entitlementPreview, setEntitlementPreview] = useState<any | null>(null);
  const [treatmentChoice, setTreatmentChoice] = useState<'AUTO' | 'UNPAID_OVERRIDE'>('AUTO');
  const [managerNote, setManagerNote] = useState<string>('');
  
  // Reject Modal States
  const [rejectModalLeave, setRejectModalLeave] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

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
    const leave = leaves.find((l) => l.id === id);
    if (!leave) return;

    if (role === 'MANAGER' && action === 'APPROVE') {
      setApprovalModalLeave(leave);
      setManagerNote('');
      setPreviewLoading(true);
      setEntitlementPreview(null);
      setTreatmentChoice('AUTO');

      try {
        const res = await getLeaveRequestEntitlementPreviewAction(leave.id);
        if (res.success && res.preview) {
          setEntitlementPreview(res.preview);
          if (res.preview.isExhausted || !res.preview.isEligible) {
            setTreatmentChoice('UNPAID_OVERRIDE');
          } else {
            setTreatmentChoice('AUTO');
          }
        } else {
          toast.error(res.error || 'Failed to fetch entitlement calculation');
          setApprovalModalLeave(null);
        }
      } catch (err: any) {
        toast.error(err?.message || 'Error fetching entitlement');
        setApprovalModalLeave(null);
      } finally {
        setPreviewLoading(false);
      }
      return;
    }

    if (role === 'MANAGER' && action === 'REJECT') {
      setRejectModalLeave(leave);
      setRejectReason('');
      return;
    }

    // Team Lead action
    const previousLeaves = [...leaves];
    setLoadingId(id);
    const nextStage = action === 'APPROVE' ? 'PENDING_MANAGER' : 'REJECTED';

    // Optimistic update
    setLeaves((prev) =>
      prev.map((l) => (l.id === id ? { ...l, currentStage: nextStage } : l))
    );

    const res = await processLeaveApprovalAction(id, action);
    setLoadingId(null);

    if (res.success) {
      toast.success(action === 'APPROVE' ? 'Leave forwarded to Management for final review!' : 'Leave application rejected.');
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
      setLeaves(previousLeaves);
      toast.error(res.error || 'Action failed');
      router.refresh();
    }
  };

  const handleManagerApprovalConfirm = async () => {
    if (!approvalModalLeave) return;

    const leaveId = approvalModalLeave.id;
    const previousLeaves = [...leaves];
    setLoadingId(leaveId);

    const overrideTreatment = treatmentChoice === 'UNPAID_OVERRIDE' ? 'UNPAID' : undefined;

    // Optimistic update
    setLeaves((prev) =>
      prev.map((l) =>
        l.id === leaveId
          ? {
              ...l,
              currentStage: 'APPROVED',
              payTreatment: overrideTreatment || entitlementPreview?.payTreatment || 'PAID',
              paidDays: overrideTreatment === 'UNPAID' ? 0 : entitlementPreview?.totalPaidDays,
              unpaidDays: overrideTreatment === 'UNPAID' ? entitlementPreview?.totalApplicableDays : entitlementPreview?.totalUnpaidDays,
              managerNote,
            }
          : l
      )
    );

    const res = await processLeaveApprovalAction(
      leaveId,
      'APPROVE',
      managerNote,
      overrideTreatment,
      managerNote
    );

    setLoadingId(null);
    setApprovalModalLeave(null);

    if (res.success) {
      const finalTreatment = res.leave?.payTreatment || (overrideTreatment === 'UNPAID' ? 'UNPAID' : entitlementPreview?.payTreatment);
      const treatmentLabel =
        finalTreatment === 'SPLIT'
          ? `${res.leave?.paidDays ?? entitlementPreview?.totalPaidDays}d Paid + ${res.leave?.unpaidDays ?? entitlementPreview?.totalUnpaidDays}d Unpaid`
          : finalTreatment === 'PAID'
          ? 'Paid Leave'
          : 'Unpaid Leave';

      toast.success(`Leave approved as ${treatmentLabel} successfully!`);
      if (res.leave) {
        setLeaves((prev) => prev.map((l) => (l.id === leaveId ? { ...l, ...res.leave } : l)));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('persevex-realtime', {
            detail: {
              type: 'LEAVE_STATUS_CHANGED',
              payload: {
                leaveId,
                stage: 'APPROVED',
                leave: res.leave || { id: leaveId, currentStage: 'APPROVED', payTreatment: finalTreatment },
              },
            },
          })
        );
      }
      router.refresh();
    } else {
      setLeaves(previousLeaves);
      toast.error(res.error || 'Failed to approve leave');
      router.refresh();
    }
  };

  const handleManagerRejectConfirm = async () => {
    if (!rejectModalLeave) return;
    const leaveId = rejectModalLeave.id;
    setLoadingId(leaveId);

    // Optimistic update
    setLeaves((prev) =>
      prev.map((l) => (l.id === leaveId ? { ...l, currentStage: 'REJECTED' } : l))
    );

    const res = await processLeaveApprovalAction(leaveId, 'REJECT', rejectReason);
    setLoadingId(null);
    setRejectModalLeave(null);

    if (res.success) {
      toast.success('Leave request rejected.');
      if (res.leave) {
        setLeaves((prev) => prev.map((l) => (l.id === leaveId ? { ...l, ...res.leave } : l)));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('persevex-realtime', {
            detail: {
              type: 'LEAVE_STATUS_CHANGED',
              payload: {
                leaveId,
                stage: 'REJECTED',
                leave: res.leave || { id: leaveId, currentStage: 'REJECTED' },
              },
            },
          })
        );
      }
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to reject leave');
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
  const approvedCount = leaves.filter((l) => l.currentStage === 'APPROVED').length;
  const rejectedCount = leaves.filter((l) => l.currentStage === 'REJECTED').length;

  const isFilterActive =
    datePreset !== 'ALL' ||
    Boolean(selectedTeam) ||
    Boolean(selectedEmployee) ||
    Boolean(statusFilter);

  return (
    <div className="space-y-4">
      {/* ─── HEADER: Gradient banner + mini stat tiles + tab switcher ─── */}
      <div className="ws-hero rounded-2xl p-5 sm:p-7 overflow-hidden">
        <div className="relative z-10">
          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Leave Management</p>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {role === 'MANAGER' ? 'Organization Leave Review' : 'Team Leave Requests'}
              </h2>
              <p className="text-white/60 text-sm mt-1">
                {pendingCount > 0
                  ? `${pendingCount} request${pendingCount > 1 ? 's' : ''} awaiting your review`
                  : 'No pending requests — you\'re all caught up!'}
              </p>
            </div>

            {/* Mini stat tiles */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-center bg-white/15 border border-white/20 rounded-xl px-4 py-2.5">
                <div className="text-2xl font-black text-white font-mono">{pendingCount}</div>
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider mt-0.5">Pending</div>
              </div>
              <div className="text-center bg-white/15 border border-white/20 rounded-xl px-4 py-2.5">
                <div className="text-2xl font-black text-white font-mono">{approvedCount}</div>
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider mt-0.5">Approved</div>
              </div>
              <div className="text-center bg-white/15 border border-white/20 rounded-xl px-4 py-2.5">
                <div className="text-2xl font-black text-white font-mono">{rejectedCount}</div>
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider mt-0.5">Rejected</div>
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl border border-white/15 w-fit">
            {[
              { key: 'PENDING', label: `Pending (${pendingCount})` },
              { key: 'APPROVED', label: 'Approved' },
              { key: 'REJECTED', label: 'Rejected' },
              { key: 'ALL', label: 'All Requests' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterStage(tab.key)}
                className={`px-3 py-1.5 rounded-lg transition text-xs font-semibold cursor-pointer ${
                  filterStage === tab.key
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* Advanced Filters Panel (Shown ONLY when "All Requests" is selected) */}
      {filterStage === 'ALL' && (
        <div className="ws-card p-3.5 space-y-3">
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
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
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
      <div className="ws-card overflow-hidden shadow-xs transition-colors">
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {l.user?.fullName}
                        </span>
                        {l.user?.role === 'TEAM_LEAD' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                            Team Lead
                          </span>
                        )}
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
                      <span className="text-xs">{l.numberOfDays ?? l.daysCount ?? 1} {Number(l.numberOfDays ?? l.daysCount ?? 1) === 1 ? 'day' : 'days'}</span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-500 dark:text-slate-400" title={l.reason}>
                      {l.reason}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={l.currentStage} />
                        {l.currentStage === 'APPROVED' && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              l.payTreatment === 'PAID'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : l.payTreatment === 'SPLIT'
                                ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {l.payTreatment === 'PAID'
                              ? `● Paid (${l.paidDays ?? l.numberOfDays}d)`
                              : l.payTreatment === 'SPLIT'
                              ? `⚡ ${l.paidDays ?? 0}d Paid + ${l.unpaidDays ?? 0}d Unpaid`
                              : `○ Unpaid (${l.unpaidDays ?? l.numberOfDays}d)`}
                          </span>
                        )}
                      </div>
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

      {/* MANAGER PAY TREATMENT APPROVAL MODAL */}
      {approvalModalLeave && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="ws-card max-w-lg w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4 my-auto">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                  <span>Approve Leave Request</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    1.5d/mo Policy
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Authoritative Monthly Paid Leave Entitlement &amp; Split Review
                </p>
              </div>
              <button
                onClick={() => setApprovalModalLeave(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Leave Summary Info */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Applicant:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  {approvalModalLeave.user?.fullName} ({approvalModalLeave.user?.employeeId})
                  {approvalModalLeave.user?.role === 'TEAM_LEAD' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                      Team Lead
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Duration:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {formatDate(approvalModalLeave.startDate)} &rarr; {formatDate(approvalModalLeave.endDate)} ({approvalModalLeave.numberOfDays} {approvalModalLeave.numberOfDays === 1 ? 'day' : 'days'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Leave Type:</span>
                <span className="font-semibold text-violet-600 dark:text-violet-400">
                  {approvalModalLeave.leaveType.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Reason:</span>
                <p className="text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  &ldquo;{approvalModalLeave.reason}&rdquo;
                </p>
              </div>
            </div>

            {/* ENTITLEMENT PREVIEW SECTION */}
            {previewLoading ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span>Calculating monthly entitlement balance and fresh monthly reset...</span>
              </div>
            ) : entitlementPreview ? (
              <div className="space-y-3">
                {/* Monthly Quota Breakdown Card */}
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-slate-200/60 dark:border-slate-800/60">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      Monthly Policy Quota
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                      1.5 Paid Days / Month
                    </span>
                  </div>

                  {/* Month-by-month details */}
                  <div className="space-y-1.5">
                    {entitlementPreview.monthSplits?.map((m: any) => (
                      <div
                        key={m.monthKey}
                        className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs flex flex-col gap-1"
                      >
                        <div className="flex justify-between items-center font-medium">
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">{m.monthName || m.monthKey}</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            Remaining: <strong className={m.remainingBefore === 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>{m.remainingBefore}</strong> / 1.5d
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-500">
                          <span>Working days: <strong className="text-slate-700 dark:text-slate-300">{m.applicableDays ?? m.applicableWorkingDays}d</strong></span>
                          <span>Allocation: <strong className="text-emerald-600 dark:text-emerald-400">{m.paidDays ?? m.paidDaysAllocated}d Paid</strong> + <strong className="text-amber-600 dark:text-amber-400">{m.unpaidDays ?? m.unpaidDaysAllocated}d Unpaid</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Alert Banner */}
                {!entitlementPreview.isEligible ? (
                  <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-xs">
                    <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Internship / Non-Full-Time Policy
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Paid leave entitlement does not apply to this employment type. All approved leaves are processed as Unpaid.
                      </p>
                    </div>
                  </div>
                ) : entitlementPreview.isExhausted ? (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-xs">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-900 dark:text-rose-200">
                        Monthly 1.5-Day Paid Leave Quota Exhausted (0 / 1.5 Days Remaining)
                      </p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                        This employee has already utilized their 1.5-day paid leave allowance for this month. By policy, Paid Leave is disabled and this request will be approved as <strong>100% Unpaid Leave</strong>.
                      </p>
                    </div>
                  </div>
                ) : entitlementPreview.payTreatment === 'SPLIT' ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-200">
                        Partial Entitlement: Automatic Split Required
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                        Employee has <strong>{entitlementPreview.totalPaidDays} paid day(s)</strong> remaining. The request is automatically split into <strong>{entitlementPreview.totalPaidDays} Paid day(s)</strong> and <strong>{entitlementPreview.totalUnpaidDays} Unpaid day(s)</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                        Full Paid Entitlement Available (100% Paid Leave)
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                        Employee has sufficient paid leave entitlement ({entitlementPreview.totalPaidDays}d). This approval will produce 0 salary deductions.
                      </p>
                    </div>
                  </div>
                )}

                {/* PAY TREATMENT SELECTOR */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    APPROVAL PAY TREATMENT <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {/* Option 1: Auto / Entitlement Based */}
                    <label
                      onClick={() => {
                        if (entitlementPreview.isExhausted || !entitlementPreview.isEligible) return;
                        setTreatmentChoice('AUTO');
                      }}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border transition ${
                        entitlementPreview.isExhausted || !entitlementPreview.isEligible
                          ? 'opacity-40 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                          : treatmentChoice === 'AUTO'
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 cursor-pointer'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="treatmentChoice"
                        value="AUTO"
                        disabled={entitlementPreview.isExhausted || !entitlementPreview.isEligible}
                        checked={treatmentChoice === 'AUTO'}
                        onChange={() => setTreatmentChoice('AUTO')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 text-xs">
                        <span className="font-semibold block">
                          {entitlementPreview.isExhausted || !entitlementPreview.isEligible
                            ? 'Paid Leave (Exhausted — 0d Available)'
                            : entitlementPreview.payTreatment === 'SPLIT'
                            ? `Approve as Auto-Split (${entitlementPreview.totalPaidDays}d Paid + ${entitlementPreview.totalUnpaidDays}d Unpaid)`
                            : `Approve as Paid Leave (${entitlementPreview.totalPaidDays}d Paid)`}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {entitlementPreview.isExhausted
                            ? 'Employee has 0 paid leave days remaining for this calendar month.'
                            : entitlementPreview.payTreatment === 'SPLIT'
                            ? `Consumes remaining ${entitlementPreview.totalPaidDays}d monthly quota; remaining ${entitlementPreview.totalUnpaidDays}d will be unpaid.`
                            : `Consumes ${entitlementPreview.totalPaidDays}d from monthly quota (0 salary deduction).`}
                        </p>
                      </div>
                    </label>

                    {/* Option 2: Unpaid Override */}
                    <label
                      onClick={() => setTreatmentChoice('UNPAID_OVERRIDE')}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border transition cursor-pointer ${
                        treatmentChoice === 'UNPAID_OVERRIDE' || entitlementPreview.isExhausted || !entitlementPreview.isEligible
                          ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/20'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="treatmentChoice"
                        value="UNPAID_OVERRIDE"
                        checked={treatmentChoice === 'UNPAID_OVERRIDE' || entitlementPreview.isExhausted || !entitlementPreview.isEligible}
                        onChange={() => setTreatmentChoice('UNPAID_OVERRIDE')}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1 text-xs">
                        <span className="font-semibold block">
                          Approve as 100% Unpaid Leave ({entitlementPreview.totalApplicableDays} {entitlementPreview.totalApplicableDays === 1 ? 'day' : 'days'})
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Deducted from monthly payroll based on daily rate. Does not consume monthly paid leave quota.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Manager Note */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                Manager Note <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={managerNote}
                onChange={(e) => setManagerNote(e.target.value)}
                placeholder="Add an internal note or message to employee..."
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setApprovalModalLeave(null)}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={previewLoading || loadingId === approvalModalLeave.id || !entitlementPreview}
                onClick={handleManagerApprovalConfirm}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {loadingId === approvalModalLeave.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {entitlementPreview
                  ? treatmentChoice === 'UNPAID_OVERRIDE' || entitlementPreview.isExhausted || !entitlementPreview.isEligible
                    ? `Confirm Approval (Unpaid · ${entitlementPreview.totalApplicableDays}d)`
                    : entitlementPreview.payTreatment === 'SPLIT'
                    ? `Confirm Approval (${entitlementPreview.totalPaidDays}d Paid + ${entitlementPreview.totalUnpaidDays}d Unpaid)`
                    : `Confirm Approval (Paid · ${entitlementPreview.totalPaidDays}d)`
                  : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGER REJECT MODAL */}
      {rejectModalLeave && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ws-card max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Reject Leave Request
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Reject request from {rejectModalLeave.user?.fullName}
                </p>
              </div>
              <button
                onClick={() => setRejectModalLeave(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                Reason for Rejection <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this request is being rejected..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRejectModalLeave(null)}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loadingId === rejectModalLeave.id}
                onClick={handleManagerRejectConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {loadingId === rejectModalLeave.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

