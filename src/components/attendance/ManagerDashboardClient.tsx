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
import { useRouter } from 'next/navigation';

import { getIndiaDateKey } from '@/lib/utils';

export default function ManagerDashboardClient({
  initialEmployees,
  initialTeams,
  initialAttendances,
}: {
  initialEmployees: any[];
  initialTeams: any[];
  initialAttendances: any[];
}) {
  const router = useRouter();

  // Dynamic Live State
  const [employees, setEmployees] = useState<any[]>(initialEmployees);
  const [teams, setTeams] = useState<any[]>(initialTeams);
  const [attendances, setAttendances] = useState<any[]>(initialAttendances);

  // 1. Filter States: TODAY, WEEK, MONTH, YEAR, CUSTOM
  const [datePreset, setDatePreset] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'>('TODAY');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'COUNT' | 'PERCENTAGE'>('COUNT');

  // Live Clock State
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [hoveredSegment, setHoveredSegment] = useState<'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | null>(null);

  // Sync with props when server refreshes
  useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  useEffect(() => {
    setAttendances(initialAttendances);
  }, [initialAttendances]);

  // Real-time synchronization
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;

        if (detail.type === 'ATTENDANCE_UPDATE') {
          const att = detail.payload?.attendance;
          if (att) {
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
        } else if (detail.type === 'WORKFORCE_UPDATE') {
          const user = detail.payload?.user;
          const action = detail.payload?.action;

          if (action === 'EMPLOYEE_CREATED' && user) {
            setEmployees((prev) => {
              if (prev.some((x) => x.id === user.id)) return prev;
              return [user, ...prev];
            });
          } else if (action === 'EMPLOYEE_UPDATED' && user) {
            setEmployees((prev) => prev.map((x) => (x.id === user.id ? { ...x, ...user } : x)));
          } else if (action === 'EMPLOYEE_DELETED' && detail.payload?.userId) {
            setEmployees((prev) => prev.filter((x) => x.id !== detail.payload.userId));
          } else if (action === 'STATUS_TOGGLED' && user) {
            setEmployees((prev) => prev.map((x) => (x.id === user.id ? { ...x, accountStatus: user.accountStatus } : x)));
          }
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, []);

  // Periodic background refresh (when window regains focus or visibility)
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

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDateStr(
        now.toLocaleDateString('en-US', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const todayStr = getIndiaDateKey(now);


  // Active Employee Pool (Filtered by Team if chosen)
  const activeEmployeePool = useMemo(() => {
    const valid = employees.filter((e) => !e.isDeleted && e.accountStatus !== 'SUSPENDED');
    if (selectedTeam) {
      return valid.filter((e) => e.teamId === selectedTeam);
    }
    return valid;
  }, [employees, selectedTeam]);

  // Reset Filters
  const resetFilters = () => {
    setDatePreset('TODAY');
    setCustomStart('');
    setCustomEnd('');
    setSelectedTeam('');
    setStatusFilter('');
    setDisplayMode('COUNT');
    setHoveredSegment(null);
  };

  // ---------------------------------------------------------------------------
  // FILTERED ATTENDANCE & SUMMARY CALCULATIONS
  // ---------------------------------------------------------------------------
  const { summary, memberBreakdown } = useMemo(() => {
    let matchingRecords = attendances.filter((r) => {
      if (selectedTeam && r.user?.teamId !== selectedTeam) return false;
      return true;
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

    // Categorize records and employees
    const onTimeUsers = new Set<string>();
    const lateUsers = new Set<string>();
    const leaveUsers = new Set<string>();

    matchingRecords.forEach((r) => {
      if (activeEmployeePool.some((e) => e.id === r.userId)) {
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

    const onTimeEmployees = activeEmployeePool.filter((e) => onTimeUsers.has(e.id));
    const lateEmployees = activeEmployeePool.filter((e) => lateUsers.has(e.id));
    const leaveEmployees = activeEmployeePool.filter((e) => leaveUsers.has(e.id));
    const absentEmployees = activeEmployeePool.filter(
      (e) => !onTimeUsers.has(e.id) && !lateUsers.has(e.id) && !leaveUsers.has(e.id)
    );

    const onTimeCount = onTimeEmployees.length;
    const lateCount = lateEmployees.length;
    const leaveCount = leaveEmployees.length;
    const absentCount = absentEmployees.length;
    const totalPresent = onTimeCount + lateCount;
    const totalWorkforce = activeEmployeePool.length || 1;

    return {
      summary: {
        totalPresent,
        onTimeCount,
        lateCount,
        leaveCount,
        absentCount,
        totalWorkforce,
      },
      memberBreakdown: {
        onTime: onTimeEmployees,
        late: lateEmployees,
        leave: leaveEmployees,
        absent: absentEmployees,
      },
    };
  }, [datePreset, attendances, activeEmployeePool, todayStr, selectedTeam, customStart, customEnd]);

    const totalSlots = summary.totalWorkforce;
    const presentPct = Math.round((summary.totalPresent / totalSlots) * 100);
    const onTimePct = Math.round((summary.onTimeCount / totalSlots) * 100);
    const latePct = Math.round((summary.lateCount / totalSlots) * 100);
    const leavePct = Math.round((summary.leaveCount / totalSlots) * 100);
    const absentPct = Math.max(0, 100 - (onTimePct + latePct + leavePct));

  // Current filter title
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
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (LIVE TIME, DATE, WORKFORCE COUNT)                          */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-slate-900 dark:text-white font-mono tracking-tight" suppressHydrationWarning>
                {currentTime || '--:--:--'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                Live Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium" suppressHydrationWarning>
              {currentDateStr || 'Today'} &middot; Main Shift: 11:00 AM – 8:00 PM (15m Grace)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Users className="w-4 h-4 text-indigo-500" />
          <span>Workforce: <strong className="text-slate-900 dark:text-white font-bold">{activeEmployeePool.length}</strong> Employees</span>
          {selectedTeam && (
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
              Team: {teams.find((t) => t.id === selectedTeam)?.name}
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. COMPACT TOOLBAR (FEW FILTERS ONLY: TODAY, WEEK, MONTH, YEAR, CUSTOM)   */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs transition-colors">
        {/* Left: Date Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 font-bold">
            {(['TODAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setDatePreset(preset);
                  setHoveredSegment(null);
                }}
                className={`px-3 py-1.5 rounded-lg transition text-xs cursor-pointer ${
                  datePreset === preset
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                  : 'Custom Range'}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs">
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

        {/* Right: Team, Status, Display Mode & Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Team Filter */}
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300 font-medium text-xs focus:outline-none"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300 font-medium text-xs focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="ON_TIME">On Time</option>
            <option value="LATE">Late Arrivals</option>
            <option value="ABSENT">Absent</option>
            <option value="ON_LEAVE">On Leave</option>
          </select>

          {/* Display Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
            <button
              onClick={() => setDisplayMode('COUNT')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                displayMode === 'COUNT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Count
            </button>
            <button
              onClick={() => setDisplayMode('PERCENTAGE')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                displayMode === 'PERCENTAGE' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Percentage (%)
            </button>
          </div>

          {/* Reset Filters */}
          <button
            onClick={resetFilters}
            className="text-xs text-rose-500 hover:text-rose-600 font-bold px-2 py-1 flex items-center gap-1 cursor-pointer transition"
            title="Reset Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. 4 RICH SUMMARY STAT CARDS (ALWAYS CLEAR & SYNCED)                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Present (On-Duty) */}
        <div
          onMouseEnter={() => setHoveredSegment('PRESENT')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 sm:p-5 rounded-2xl space-y-2.5 transition cursor-pointer ${
            hoveredSegment === 'PRESENT' ? 'ring-2 ring-emerald-500 shadow-md scale-[1.01]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Present (On-Duty)
            </span>
            <span className="text-xs font-mono font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
              {presentPct}%
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
              {displayMode === 'PERCENTAGE' ? `${presentPct}%` : summary.totalPresent}
            </div>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400 mt-0.5 font-medium">
              {summary.onTimeCount} on-time &middot; {summary.lateCount} late arrivals
            </p>
          </div>
          <div className="w-full h-2 bg-emerald-200/60 dark:bg-emerald-950 rounded-full overflow-hidden">
            <div
              style={{ width: `${presentPct}%` }}
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            />
          </div>
        </div>

        {/* Late Arrivals */}
        <div
          onMouseEnter={() => setHoveredSegment('LATE')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 sm:p-5 rounded-2xl space-y-2.5 transition cursor-pointer ${
            hoveredSegment === 'LATE' ? 'ring-2 ring-amber-500 shadow-md scale-[1.01]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Late Arrivals
            </span>
            <span className="text-xs font-mono font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
              {latePct}%
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-amber-700 dark:text-amber-300 font-mono">
              {displayMode === 'PERCENTAGE' ? `${latePct}%` : summary.lateCount}
            </div>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400 mt-0.5 font-medium">
              Arrived after 11:15 AM grace threshold
            </p>
          </div>
          <div className="w-full h-2 bg-amber-200/60 dark:bg-amber-950 rounded-full overflow-hidden">
            <div
              style={{ width: `${latePct}%` }}
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
            />
          </div>
        </div>

        {/* Absent */}
        <div
          onMouseEnter={() => setHoveredSegment('ABSENT')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 p-4 sm:p-5 rounded-2xl space-y-2.5 transition cursor-pointer ${
            hoveredSegment === 'ABSENT' ? 'ring-2 ring-rose-500 shadow-md scale-[1.01]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-600" /> Absent (Unpunched)
            </span>
            <span className="text-xs font-mono font-extrabold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-md">
              {absentPct}%
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-rose-700 dark:text-rose-300 font-mono">
              {displayMode === 'PERCENTAGE' ? `${absentPct}%` : summary.absentCount}
            </div>
            <p className="text-[11px] text-rose-600/80 dark:text-rose-400 mt-0.5 font-medium">
              No clock-in recorded on scheduled day
            </p>
          </div>
          <div className="w-full h-2 bg-rose-200/60 dark:bg-rose-950 rounded-full overflow-hidden">
            <div
              style={{ width: `${absentPct}%` }}
              className="h-full bg-rose-500 rounded-full transition-all duration-500"
            />
          </div>
        </div>

        {/* Approved Leave */}
        <div
          onMouseEnter={() => setHoveredSegment('LEAVE')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 p-4 sm:p-5 rounded-2xl space-y-2.5 transition cursor-pointer ${
            hoveredSegment === 'LEAVE' ? 'ring-2 ring-purple-500 shadow-md scale-[1.01]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-purple-600" /> Approved Leave
            </span>
            <span className="text-xs font-mono font-extrabold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-md">
              {leavePct}%
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-purple-700 dark:text-purple-300 font-mono">
              {displayMode === 'PERCENTAGE' ? `${leavePct}%` : summary.leaveCount}
            </div>
            <p className="text-[11px] text-purple-600/80 dark:text-purple-400 mt-0.5 font-medium">
              Sanctioned leave requests
            </p>
          </div>
          <div className="w-full h-2 bg-purple-200/60 dark:bg-purple-950 rounded-full overflow-hidden">
            <div
              style={{ width: `${leavePct}%` }}
              className="h-full bg-purple-500 rounded-full transition-all duration-500"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ONLY SINGLE HORIZONTAL PROGRESS BAR GRAPH WITH NON-CLIPPING HOVER INFO */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-5 transition-colors">
        {/* Header & Status Legend */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Workforce Attendance Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {hoveredSegment ? (
                <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  {hoveredSegment === 'PRESENT' && `Inspecting: Present (On-Duty) — ${summary.totalPresent} members (${presentPct}%) [${summary.onTimeCount} on-time, ${summary.lateCount} late]`}
                  {hoveredSegment === 'LATE' && `Inspecting: Late Arrivals — ${summary.lateCount} members (${latePct}%)`}
                  {hoveredSegment === 'ABSENT' && `Inspecting: Absent — ${summary.absentCount} members (${absentPct}%)`}
                  {hoveredSegment === 'LEAVE' && `Inspecting: Approved Leave — ${summary.leaveCount} members (${leavePct}%)`}
                </span>
              ) : (
                <>
                  Single unified horizontal composition for <strong className="text-slate-800 dark:text-slate-200 font-bold">{filterTitle}</strong> ({summary.totalWorkforce} Total Members)
                </>
              )}
            </p>
          </div>

          {/* Color Legend Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 text-xs font-bold">
            <button
              onClick={() => setHoveredSegment(hoveredSegment === 'PRESENT' ? null : 'PRESENT')}
              onMouseEnter={() => setHoveredSegment('PRESENT')}
              onMouseLeave={() => setHoveredSegment(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition cursor-pointer ${
                hoveredSegment === 'PRESENT' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500' : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
              <span>Present ({summary.totalPresent})</span>
            </button>
            <button
              onClick={() => setHoveredSegment(hoveredSegment === 'LATE' ? null : 'LATE')}
              onMouseEnter={() => setHoveredSegment('LATE')}
              onMouseLeave={() => setHoveredSegment(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition cursor-pointer ${
                hoveredSegment === 'LATE' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500' : 'text-slate-700 dark:text-slate-300 hover:text-amber-600'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
              <span>Late ({summary.lateCount})</span>
            </button>
            <button
              onClick={() => setHoveredSegment(hoveredSegment === 'ABSENT' ? null : 'ABSENT')}
              onMouseEnter={() => setHoveredSegment('ABSENT')}
              onMouseLeave={() => setHoveredSegment(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition cursor-pointer ${
                hoveredSegment === 'ABSENT' ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500' : 'text-slate-700 dark:text-slate-300 hover:text-rose-600'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm" />
              <span>Absent ({summary.absentCount})</span>
            </button>
            <button
              onClick={() => setHoveredSegment(hoveredSegment === 'LEAVE' ? null : 'LEAVE')}
              onMouseEnter={() => setHoveredSegment('LEAVE')}
              onMouseLeave={() => setHoveredSegment(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition cursor-pointer ${
                hoveredSegment === 'LEAVE' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500' : 'text-slate-700 dark:text-slate-300 hover:text-purple-600'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-purple-500 shadow-sm" />
              <span>On Leave ({summary.leaveCount})</span>
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* ONE SINGLE HORIZONTAL BAR WITH RICH NON-CLIPPING HOVER TOOLTIP          */}
        {/* ----------------------------------------------------------------------- */}
        <div className="space-y-3 pt-6 pb-2 relative">
          {/* Main Single Horizontal Bar Container (overflow-visible so tooltip is crystal clear) */}
          <div className="w-full h-12 bg-slate-100 dark:bg-slate-950 rounded-2xl p-1.5 border border-slate-200/80 dark:border-slate-800 flex items-center shadow-inner relative overflow-visible">
            {/* Segment 1: Present (On-Time) */}
            {summary.onTimeCount > 0 && (!statusFilter || statusFilter === 'PRESENT' || statusFilter === 'ON_TIME') && (
              <div
                onMouseEnter={() => setHoveredSegment('PRESENT')}
                onMouseLeave={() => setHoveredSegment(null)}
                style={{ width: `${(summary.onTimeCount / totalSlots) * 100}%` }}
                className={`h-full bg-emerald-500 rounded-l-xl transition-all duration-300 relative group cursor-pointer flex items-center justify-center text-white text-xs font-mono font-black shadow-sm ${
                  summary.lateCount === 0 && summary.leaveCount === 0 && summary.absentCount === 0 ? 'rounded-r-xl' : ''
                } ${
                  hoveredSegment === 'PRESENT' ? 'brightness-110 ring-4 ring-emerald-400/40 z-30 scale-y-110 shadow-lg' : 'hover:brightness-105'
                }`}
              >
                <span className="truncate px-1.5 text-xs drop-shadow-sm font-bold">
                  {displayMode === 'PERCENTAGE' ? (onTimePct >= 6 ? `${onTimePct}%` : '') : summary.onTimeCount}
                </span>

                {/* Floating Tooltip with Employee Names */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white border border-slate-800 p-3.5 rounded-2xl shadow-2xl text-[11px] min-w-[200px] max-w-[280px] whitespace-normal transition-all duration-150 animate-in fade-in zoom-in-95">
                  <div className="font-bold flex items-center justify-between gap-1.5 text-emerald-400 pb-1.5 border-b border-slate-800 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Present (On-Time)
                    </span>
                    <span className="font-mono text-white text-xs">{summary.onTimeCount} ({onTimePct}%)</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-300">Punched in before 11:15 AM</p>
                    {memberBreakdown.onTime.length > 0 && (
                      <div className="pt-1 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">Members:</span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {memberBreakdown.onTime.map((m) => (
                            <span key={m.id} className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded-md font-medium">
                              {m.fullName}
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
                className={`h-full bg-amber-500 transition-all duration-300 relative group cursor-pointer flex items-center justify-center text-white text-xs font-mono font-black shadow-sm ${
                  summary.onTimeCount === 0 ? 'rounded-l-xl' : ''
                } ${summary.absentCount === 0 && summary.leaveCount === 0 ? 'rounded-r-xl' : ''} ${
                  hoveredSegment === 'LATE' ? 'brightness-110 ring-4 ring-amber-400/40 z-30 scale-y-110 shadow-lg' : 'hover:brightness-105'
                }`}
              >
                <span className="truncate px-1.5 text-xs drop-shadow-sm font-bold">
                  {displayMode === 'PERCENTAGE' ? (latePct >= 6 ? `${latePct}%` : '') : summary.lateCount}
                </span>

                {/* Floating Tooltip with Employee Names */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white border border-slate-800 p-3.5 rounded-2xl shadow-2xl text-[11px] min-w-[200px] max-w-[280px] whitespace-normal transition-all duration-150 animate-in fade-in zoom-in-95">
                  <div className="font-bold flex items-center justify-between gap-1.5 text-amber-400 pb-1.5 border-b border-slate-800 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Late Arrivals
                    </span>
                    <span className="font-mono text-white text-xs">{summary.lateCount} ({latePct}%)</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-300">Punched in after 11:15 AM</p>
                    {memberBreakdown.late.length > 0 && (
                      <div className="pt-1 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">Members:</span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {memberBreakdown.late.map((m) => (
                            <span key={m.id} className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/60 px-1.5 py-0.5 rounded-md font-medium">
                              {m.fullName}
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
                style={{ width: `${(summary.leaveCount / totalSlots) * 100}%` }}
                className={`h-full bg-purple-500 transition-all duration-300 relative group cursor-pointer flex items-center justify-center text-white text-xs font-mono font-black shadow-sm ${
                  summary.onTimeCount === 0 && summary.lateCount === 0 ? 'rounded-l-xl' : ''
                } ${summary.absentCount === 0 ? 'rounded-r-xl' : ''} ${
                  hoveredSegment === 'LEAVE' ? 'brightness-110 ring-4 ring-purple-400/40 z-30 scale-y-110 shadow-lg' : 'hover:brightness-105'
                }`}
              >
                <span className="truncate px-1.5 text-xs drop-shadow-sm font-bold">
                  {displayMode === 'PERCENTAGE' ? (leavePct >= 6 ? `${leavePct}%` : '') : summary.leaveCount}
                </span>

                {/* Floating Tooltip with Employee Names */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white border border-slate-800 p-3.5 rounded-2xl shadow-2xl text-[11px] min-w-[200px] max-w-[280px] whitespace-normal transition-all duration-150 animate-in fade-in zoom-in-95">
                  <div className="font-bold flex items-center justify-between gap-1.5 text-purple-400 pb-1.5 border-b border-slate-800 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" /> Approved Leave
                    </span>
                    <span className="font-mono text-white text-xs">{summary.leaveCount} ({leavePct}%)</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-300">Sanctioned time-off requests</p>
                    {memberBreakdown.leave.length > 0 && (
                      <div className="pt-1 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">Members:</span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {memberBreakdown.leave.map((m) => (
                            <span key={m.id} className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800/60 px-1.5 py-0.5 rounded-md font-medium">
                              {m.fullName}
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
                style={{ width: `${(summary.absentCount / totalSlots) * 100}%` }}
                className={`h-full bg-rose-500 rounded-r-xl transition-all duration-300 relative group cursor-pointer flex items-center justify-center text-white text-xs font-mono font-black shadow-sm ${
                  summary.onTimeCount === 0 && summary.lateCount === 0 && summary.leaveCount === 0 ? 'rounded-l-xl' : ''
                } ${
                  hoveredSegment === 'ABSENT' ? 'brightness-110 ring-4 ring-rose-400/40 z-30 scale-y-110 shadow-lg' : 'hover:brightness-105'
                }`}
              >
                <span className="truncate px-1.5 text-xs drop-shadow-sm font-bold">
                  {displayMode === 'PERCENTAGE' ? (absentPct >= 6 ? `${absentPct}%` : '') : summary.absentCount}
                </span>

                {/* Floating Tooltip with Employee Names */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white border border-slate-800 p-3.5 rounded-2xl shadow-2xl text-[11px] min-w-[200px] max-w-[280px] whitespace-normal transition-all duration-150 animate-in fade-in zoom-in-95">
                  <div className="font-bold flex items-center justify-between gap-1.5 text-rose-400 pb-1.5 border-b border-slate-800 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Absent (Unpunched)
                    </span>
                    <span className="font-mono text-white text-xs">{summary.absentCount} ({absentPct}%)</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-300">No clock-in recorded</p>
                    {memberBreakdown.absent.length > 0 && (
                      <div className="pt-1 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">Members:</span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {memberBreakdown.absent.map((m) => (
                            <span key={m.id} className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800/60 px-1.5 py-0.5 rounded-md font-medium">
                              {m.fullName}
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

          {/* Scale Markers (0%, 25%, 50%, 75%, 100%) */}
          <div className="flex justify-between items-center px-1 text-[10px] font-mono text-slate-400 pt-1 font-bold">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100% ({summary.totalWorkforce} Total Members)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
