'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  RotateCcw,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarDays,
  Users,
  Info
} from 'lucide-react';
import LiveAttendanceCard from './LiveAttendanceCard';
import { useRouter } from 'next/navigation';

import { getIndiaDateKey } from '@/lib/utils';

export default function TeamLeadDashboardClient({
  teamMembers,
  initialAttendances,
  tlAttendance,
  currentUserId,
  teamName,
}: {
  teamMembers: any[];
  initialAttendances: any[];
  tlAttendance: any;
  currentUserId: string;
  teamName: string;
}) {
  const router = useRouter();

  // Dynamic Live State
  const [members, setMembers] = useState<any[]>(teamMembers);
  const [attendances, setAttendances] = useState<any[]>(initialAttendances);

  // 1. Filter States: TODAY, WEEK, MONTH, YEAR, CUSTOM
  const [datePreset, setDatePreset] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'>('TODAY');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'COUNT' | 'PERCENTAGE'>('COUNT');

  // Hover state for horizontal bar
  const [hoveredSegment, setHoveredSegment] = useState<'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | null>(null);

  useEffect(() => {
    setMembers(teamMembers);
  }, [teamMembers]);

  useEffect(() => {
    setAttendances(initialAttendances);
  }, [initialAttendances]);

  // Real-time synchronization via SSE (strictly scoped to Squad + TL)
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;

        if (detail.type === 'ATTENDANCE_UPDATE') {
          const att = detail.payload?.attendance;
          if (att) {
            // Only accept if this user is in the Team Lead's squad or is the TL themselves
            const isSquadMember = members.some((m) => m.id === att.userId) || att.userId === currentUserId;
            if (!isSquadMember) return;

            setAttendances((prev) => {
              const idx = prev.findIndex(
                (r) =>
                  r.id === att.id ||
                  (r.userId === att.userId && getIndiaDateKey(r.date) === getIndiaDateKey(att.date))
              );
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...att };
                return copy;
              }
              return [att, ...prev];
            });
          }
        } else if (detail.type === 'WORKFORCE_UPDATE' || detail.type === 'LEAVE_STATUS_CHANGED') {
          router.refresh();
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [router, members, currentUserId]);

  // Background refresh on window focus
  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') router.refresh();
    });

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [router]);

  const now = new Date();
  const todayStr = getIndiaDateKey(now);


  // Active squad pool (Squad members + Team Lead; Managers excluded)
  const activeSquadPool = useMemo(() => {
    return members.filter((m) => !m.isDeleted && m.accountStatus !== 'SUSPENDED' && m.role !== 'MANAGER');
  }, [members]);


  const resetFilters = () => {
    setDatePreset('TODAY');
    setCustomStart('');
    setCustomEnd('');
    setStatusFilter('');
    setDisplayMode('COUNT');
    setHoveredSegment(null);
  };

  // Filtered Attendance & Summary Calculations
  const { summary, memberBreakdown } = useMemo(() => {
    let matchingRecords = attendances.filter((r) => {
      return activeSquadPool.some((m) => m.id === r.userId);
    });

    if (datePreset === 'TODAY') {
      matchingRecords = matchingRecords.filter((r) => getIndiaDateKey(r.date) === todayStr);
    } else if (datePreset === 'WEEK') {

      const dayOfWeek = now.getDay();
      const distanceToMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0, 0);
      matchingRecords = matchingRecords.filter((r) => {
        const d = new Date(r.date);
        return d >= monday && d <= now;
      });
    } else if (datePreset === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      matchingRecords = matchingRecords.filter((r) => {
        const d = new Date(r.date);
        return d >= startOfMonth && d <= now;
      });
    } else if (datePreset === 'YEAR') {
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      matchingRecords = matchingRecords.filter((r) => {
        const d = new Date(r.date);
        return d >= startOfYear && d <= now;
      });
    } else if (datePreset === 'CUSTOM') {
      const s = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      const e = customEnd ? new Date(customEnd) : new Date(now);
      matchingRecords = matchingRecords.filter((r) => {
        const d = new Date(r.date);
        return d >= s && d <= e;
      });
    }

    const onTimeUsers = new Set<string>();
    const lateUsers = new Set<string>();
    const leaveUsers = new Set<string>();

    matchingRecords.forEach((r) => {
      if (activeSquadPool.some((m) => m.id === r.userId)) {
        if (r.status === 'ON_LEAVE') {
          leaveUsers.add(r.userId);
        } else if (r.status === 'PRESENT') {
          if (r.lateStatus === 'LATE') {
            lateUsers.add(r.userId);
          } else {
            onTimeUsers.add(r.userId);
          }
        }
      }
    });

    const onTimeEmployees = activeSquadPool.filter((e) => onTimeUsers.has(e.id));
    const lateEmployees = activeSquadPool.filter((e) => lateUsers.has(e.id));
    const leaveEmployees = activeSquadPool.filter((e) => leaveUsers.has(e.id));
    // Independent Absent count = anyone with no check-in record for selected date
    const absentEmployees = activeSquadPool.filter(
      (e) => !onTimeUsers.has(e.id) && !lateUsers.has(e.id)
    );
    // Unpunched leave employees for unique bar partitioning
    const unpunchedLeaveEmployees = leaveEmployees.filter(
      (e) => !onTimeUsers.has(e.id) && !lateUsers.has(e.id)
    );
    const unexcusedAbsentEmployees = activeSquadPool.filter(
      (e) => !onTimeUsers.has(e.id) && !lateUsers.has(e.id) && !leaveUsers.has(e.id)
    );

    const onTimeCount = onTimeEmployees.length;
    const lateCount = lateEmployees.length;
    const leaveCount = leaveEmployees.length;
    const absentCount = absentEmployees.length;
    const unpunchedLeaveCount = unpunchedLeaveEmployees.length;
    const unexcusedAbsentCount = unexcusedAbsentEmployees.length;
    const totalPresent = onTimeCount + lateCount;
    const totalSquad = activeSquadPool.length || 1;

    return {
      summary: {
        totalPresent,
        onTimeCount,
        lateCount,
        leaveCount,
        absentCount,
        unpunchedLeaveCount,
        unexcusedAbsentCount,
        totalSquad,
      },
      memberBreakdown: {
        onTime: onTimeEmployees,
        late: lateEmployees,
        leave: leaveEmployees,
        absent: absentEmployees,
        unpunchedLeave: unpunchedLeaveEmployees,
        unexcusedAbsent: unexcusedAbsentEmployees,
      },
    };
  }, [datePreset, attendances, activeSquadPool, todayStr, customStart, customEnd]);

  const totalSlots = summary.totalSquad;
  const presentPct = Math.round((summary.totalPresent / totalSlots) * 100);
  const onTimePct = Math.round((summary.onTimeCount / totalSlots) * 100);
  const latePct = Math.round((summary.lateCount / totalSlots) * 100);
  const leavePct = Math.round((summary.leaveCount / totalSlots) * 100);
  const absentPct = Math.round((summary.absentCount / totalSlots) * 100);

  const filterTitle =
    datePreset === 'TODAY'
      ? 'Today'
      : datePreset === 'WEEK'
      ? 'This Week'
      : datePreset === 'MONTH'
      ? 'This Month'
      : datePreset === 'YEAR'
      ? 'This Year'
      : 'Custom Range';

  return (
    <div className="space-y-4">
      {/* 1. Attendance Punch Marker for Team Lead */}
      <LiveAttendanceCard initialAttendance={tlAttendance} currentUserId={currentUserId} />

      {/* 2. Compact Filter Toolbar (Today, Week, Month, Year, Custom) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs transition-colors">
        {/* Left: Date Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {(['TODAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setDatePreset(preset);
                  setHoveredSegment(null);
                }}
                className={`px-2.5 py-1 rounded-md transition text-xs font-medium cursor-pointer ${
                  datePreset === preset
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {preset === 'TODAY'
                  ? 'Today'
                  : preset === 'WEEK'
                  ? 'Week'
                  : preset === 'MONTH'
                  ? 'Month'
                  : preset === 'YEAR'
                  ? 'Year'
                  : 'Custom'}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'CUSTOM' && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none"
              />
              <span className="text-slate-400">&rarr;</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Right: Status, Display Mode & Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-slate-700 dark:text-slate-300 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="ON_TIME">On Time</option>
            <option value="LATE">Late Arrivals</option>
            <option value="ABSENT">Absent</option>
            <option value="ON_LEAVE">On Leave</option>
          </select>

          {/* Display Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setDisplayMode('COUNT')}
              className={`px-2 py-0.5 rounded-md transition cursor-pointer text-xs ${
                displayMode === 'COUNT' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Count
            </button>
            <button
              onClick={() => setDisplayMode('PERCENTAGE')}
              className={`px-2 py-0.5 rounded-md transition cursor-pointer text-xs ${
                displayMode === 'PERCENTAGE' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              %
            </button>
          </div>

          {/* Reset Filters */}
          <button
            onClick={resetFilters}
            className="h-8 px-2 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-medium flex items-center gap-1 cursor-pointer transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Reset Filters"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {/* 3. 4 Refined Summary Stat Cards (Synced to TL Squad) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Present (On-Duty) */}
        <div
          onMouseEnter={() => setHoveredSegment('PRESENT')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs space-y-2.5 transition cursor-pointer ${
            hoveredSegment === 'PRESENT'
              ? 'border-emerald-500 ring-1 ring-emerald-500/30'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Present
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
              {presentPct}%
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {displayMode === 'PERCENTAGE' ? `${presentPct}%` : summary.totalPresent}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {summary.onTimeCount} on-time &middot; {summary.lateCount} late
            </p>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              style={{ width: `${presentPct}%` }}
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            />
          </div>
        </div>

        {/* Late Arrivals */}
        <div
          onMouseEnter={() => setHoveredSegment('LATE')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs space-y-2.5 transition cursor-pointer ${
            hoveredSegment === 'LATE'
              ? 'border-amber-500 ring-1 ring-amber-500/30'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Late Arrivals
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/60">
              {latePct}%
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {displayMode === 'PERCENTAGE' ? `${latePct}%` : summary.lateCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              After 11:15 AM grace cutoff
            </p>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              style={{ width: `${latePct}%` }}
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
            />
          </div>
        </div>

        {/* Absent */}
        <div
          onMouseEnter={() => setHoveredSegment('ABSENT')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs space-y-2.5 transition cursor-pointer ${
            hoveredSegment === 'ABSENT'
              ? 'border-rose-500 ring-1 ring-rose-500/30'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <XCircle className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Absent
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded-md border border-rose-200/60 dark:border-rose-800/60">
              {absentPct}%
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {displayMode === 'PERCENTAGE' ? `${absentPct}%` : summary.absentCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Unpunched shift
            </p>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              style={{ width: `${absentPct}%` }}
              className="h-full bg-rose-500 rounded-full transition-all duration-300"
            />
          </div>
        </div>

        {/* Approved Leave */}
        <div
          onMouseEnter={() => setHoveredSegment('LEAVE')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs space-y-2.5 transition cursor-pointer ${
            hoveredSegment === 'LEAVE'
              ? 'border-violet-500 ring-1 ring-violet-500/30'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/50 border border-violet-200/60 dark:border-violet-800/60 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <CalendarDays className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Approved Leave
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50 px-1.5 py-0.5 rounded-md border border-violet-200/60 dark:border-violet-800/60">
              {leavePct}%
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {displayMode === 'PERCENTAGE' ? `${leavePct}%` : summary.leaveCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Sanctioned time-off
            </p>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              style={{ width: `${leavePct}%` }}
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* 4. Single Horizontal Attendance Distribution Bar (Squad Scoped) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl shadow-xs space-y-4 transition-colors">
        {/* Header & Status Legend */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {teamName || 'Squad'} Attendance Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {hoveredSegment ? (
                <span className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {hoveredSegment === 'PRESENT' && `Present: ${summary.totalPresent} members (${presentPct}%) [${summary.onTimeCount} on-time, ${summary.lateCount} late]`}
                  {hoveredSegment === 'LATE' && `Late: ${summary.lateCount} members (${latePct}%)`}
                  {hoveredSegment === 'ABSENT' && `Absent: ${summary.absentCount} members (${absentPct}%)`}
                  {hoveredSegment === 'LEAVE' && `On Leave: ${summary.leaveCount} members (${leavePct}%)`}
                </span>
              ) : (
                <>
                  Squad attendance for <strong className="text-slate-700 dark:text-slate-300">{filterTitle}</strong> ({summary.totalSquad} Squad Members)
                </>
              )}
            </p>
          </div>

          {/* Color Legend Buttons */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setHoveredSegment(hoveredSegment === 'PRESENT' ? null : 'PRESENT')}
              onMouseEnter={() => setHoveredSegment('PRESENT')}
              onMouseLeave={() => setHoveredSegment(null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition cursor-pointer ${
                hoveredSegment === 'PRESENT' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Present ({summary.totalPresent})</span>
            </button>
            <button
              onClick={() => setHoveredSegment(hoveredSegment === 'LATE' ? null : 'LATE')}
              onMouseEnter={() => setHoveredSegment('LATE')}
              onMouseLeave={() => setHoveredSegment(null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition cursor-pointer ${
                hoveredSegment === 'LATE' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Late ({summary.lateCount})</span>
            </button>
            <button
              onClick={() => setHoveredSegment(hoveredSegment === 'ABSENT' ? null : 'ABSENT')}
              onMouseEnter={() => setHoveredSegment('ABSENT')}
              onMouseLeave={() => setHoveredSegment(null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition cursor-pointer ${
                hoveredSegment === 'ABSENT' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Absent ({summary.absentCount})</span>
            </button>
            <button
              onClick={() => setHoveredSegment(hoveredSegment === 'LEAVE' ? null : 'LEAVE')}
              onMouseEnter={() => setHoveredSegment('LEAVE')}
              onMouseLeave={() => setHoveredSegment(null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition cursor-pointer ${
                hoveredSegment === 'LEAVE' ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span>Leave ({summary.leaveCount})</span>
            </button>
          </div>
        </div>

        {/* Single Horizontal Bar Container */}
        <div className="space-y-2 pt-2">
          <div className="w-full h-8 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200/80 dark:border-slate-700 flex items-center relative overflow-visible">
            {/* Segment 1: Present (On-Time) */}
            {summary.onTimeCount > 0 && (!statusFilter || statusFilter === 'PRESENT' || statusFilter === 'ON_TIME') && (
              <div
                onMouseEnter={() => setHoveredSegment('PRESENT')}
                onMouseLeave={() => setHoveredSegment(null)}
                style={{ width: `${(summary.onTimeCount / totalSlots) * 100}%` }}
                className={`h-full bg-emerald-500 rounded-l-md transition-all duration-200 relative group cursor-pointer flex items-center justify-center text-white text-xs font-mono font-bold ${
                  summary.lateCount === 0 && summary.leaveCount === 0 && summary.absentCount === 0 ? 'rounded-r-md' : ''
                } ${
                  hoveredSegment === 'PRESENT' ? 'brightness-110 ring-2 ring-emerald-400/50 z-30' : 'hover:brightness-105'
                }`}
              >
                <span className="truncate px-1 text-[11px] font-semibold">
                  {displayMode === 'PERCENTAGE' ? (onTimePct >= 6 ? `${onTimePct}%` : '') : summary.onTimeCount}
                </span>

                {/* Floating Tooltip with Squad Member Names */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white border border-slate-800 p-3 rounded-xl shadow-xl text-xs min-w-[180px] max-w-[260px] whitespace-normal transition-all duration-100">
                  <div className="font-semibold flex items-center justify-between gap-1 text-emerald-400 pb-1 border-b border-slate-800 mb-1">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> On-Time
                    </span>
                    <span className="font-mono text-white text-xs">{summary.onTimeCount} ({onTimePct}%)</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-300 text-[11px]">Before 11:15 AM</p>
                    {memberBreakdown.onTime.length > 0 && (
                      <div className="pt-1 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Squad Members:</span>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {memberBreakdown.onTime.map((m) => (
                            <span key={m.id} className="text-[10px] bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                              {m.fullName} {m.id === currentUserId ? '(You / Lead)' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Segment 2: Late Arrivals */}
            {summary.lateCount > 0 && (!statusFilter || statusFilter === 'PRESENT' || statusFilter === 'LATE') && (
              <div
                onMouseEnter={() => setHoveredSegment('LATE')}
                onMouseLeave={() => setHoveredSegment(null)}
                style={{ width: `${(summary.lateCount / totalSlots) * 100}%` }}
                className={`h-full bg-amber-500 transition-all duration-200 relative group cursor-pointer flex items-center justify-center text-white text-xs font-mono font-bold ${
                  summary.onTimeCount === 0 ? 'rounded-l-md' : ''
                } ${summary.absentCount === 0 && summary.leaveCount === 0 ? 'rounded-r-md' : ''} ${
                  hoveredSegment === 'LATE' ? 'brightness-110 ring-2 ring-amber-400/50 z-30' : 'hover:brightness-105'
                }`}
              >
                <span className="truncate px-1 text-[11px] font-semibold">
                  {displayMode === 'PERCENTAGE' ? (latePct >= 6 ? `${latePct}%` : '') : summary.lateCount}
                </span>

                {/* Floating Tooltip with Squad Member Names */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white border border-slate-800 p-3 rounded-xl shadow-xl text-xs min-w-[180px] max-w-[260px] whitespace-normal transition-all duration-100">
                  <div className="font-semibold flex items-center justify-between gap-1 text-amber-400 pb-1 border-b border-slate-800 mb-1">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Late Arrivals
                    </span>
                    <span className="font-mono text-white text-xs">{summary.lateCount} ({latePct}%)</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-300 text-[11px]">After 11:15 AM</p>
                    {memberBreakdown.late.length > 0 && (
                      <div className="pt-1 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Squad Members:</span>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {memberBreakdown.late.map((m) => (
                            <span key={m.id} className="text-[10px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-medium">
                              {m.fullName} {m.id === currentUserId ? '(You / Lead)' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Segment 3: Approved Leave */}
            {summary.leaveCount > 0 && (!statusFilter || statusFilter === 'ON_LEAVE') && (
              <div
                onMouseEnter={() => setHoveredSegment('LEAVE')}
                onMouseLeave={() => setHoveredSegment(null)}
                style={{ width: `${(summary.unpunchedLeaveCount / totalSlots) * 100}%` }}
                className={`h-full bg-violet-500 transition-all duration-200 relative group cursor-pointer flex items-center justify-center text-white text-xs font-mono font-bold ${
                  summary.onTimeCount === 0 && summary.lateCount === 0 ? 'rounded-l-md' : ''
                } ${summary.unexcusedAbsentCount === 0 ? 'rounded-r-md' : ''} ${
                  hoveredSegment === 'LEAVE' ? 'brightness-110 ring-2 ring-violet-400/50 z-30' : 'hover:brightness-105'
                }`}
              >
                <span className="truncate px-1 text-[11px] font-semibold">
                  {displayMode === 'PERCENTAGE' ? (leavePct >= 6 ? `${leavePct}%` : '') : summary.leaveCount}
                </span>

                {/* Floating Tooltip with Squad Member Names */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white border border-slate-800 p-3 rounded-xl shadow-xl text-xs min-w-[180px] max-w-[260px] whitespace-normal transition-all duration-100">
                  <div className="font-semibold flex items-center justify-between gap-1 text-violet-400 pb-1 border-b border-slate-800 mb-1">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Approved Leave
                    </span>
                    <span className="font-mono text-white text-xs">{summary.leaveCount} ({leavePct}%)</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-300 text-[11px]">Sanctioned time-off</p>
                    {memberBreakdown.leave.length > 0 && (
                      <div className="pt-1 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Squad Members:</span>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {memberBreakdown.leave.map((m) => (
                            <span key={m.id} className="text-[10px] bg-slate-800 text-violet-300 px-1.5 py-0.5 rounded font-medium">
                              {m.fullName} {m.id === currentUserId ? '(You / Lead)' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Segment 4: Absent */}
            {summary.absentCount > 0 && (!statusFilter || statusFilter === 'ABSENT') && (
              <div
                onMouseEnter={() => setHoveredSegment('ABSENT')}
                onMouseLeave={() => setHoveredSegment(null)}
                style={{ width: `${(summary.unexcusedAbsentCount / totalSlots) * 100}%` }}
                className={`h-full bg-rose-500 rounded-r-md transition-all duration-200 relative group cursor-pointer flex items-center justify-center text-white text-xs font-mono font-bold ${
                  summary.onTimeCount === 0 && summary.lateCount === 0 && summary.unpunchedLeaveCount === 0 ? 'rounded-l-md' : ''
                } ${
                  hoveredSegment === 'ABSENT' ? 'brightness-110 ring-2 ring-rose-400/50 z-30' : 'hover:brightness-105'
                }`}
              >
                <span className="truncate px-1 text-[11px] font-semibold">
                  {displayMode === 'PERCENTAGE' ? (absentPct >= 6 ? `${absentPct}%` : '') : summary.absentCount}
                </span>

                {/* Floating Tooltip with Squad Member Names */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white border border-slate-800 p-3 rounded-xl shadow-xl text-xs min-w-[180px] max-w-[260px] whitespace-normal transition-all duration-100">
                  <div className="font-semibold flex items-center justify-between gap-1 text-rose-400 pb-1 border-b border-slate-800 mb-1">
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Absent
                    </span>
                    <span className="font-mono text-white text-xs">{summary.absentCount} ({absentPct}%)</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-300 text-[11px]">No clock-in recorded</p>
                    {memberBreakdown.absent.length > 0 && (
                      <div className="pt-1 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Squad Members:</span>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {memberBreakdown.absent.map((m) => (
                            <span key={m.id} className="text-[10px] bg-slate-800 text-rose-300 px-1.5 py-0.5 rounded font-medium">
                              {m.fullName} {m.id === currentUserId ? '(You / Lead)' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scale Markers */}
          <div className="flex justify-between items-center px-0.5 text-[10px] font-mono text-slate-400 font-medium">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100% ({summary.totalSquad} Total Squad Members)</span>
          </div>
        </div>
      </div>
    </div>
  );

}
