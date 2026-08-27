'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  PieChart,
  Loader2,
  Check,
  AlertTriangle,
  LogIn,
  LogOut
} from 'lucide-react';
import { formatDate, formatTime, getIndiaDateKey, formatDurationHMSFormatted } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  initialTodayAttendance: any;
  allRecords: any[];
  holidays?: any[];
  currentUserId?: string;
}

export default function EmployeeAttendanceHub({
  initialTodayAttendance,
  allRecords = [],
  currentUserId,
}: Props) {
  const [todayAtt, setTodayAtt] = useState(initialTodayAttendance);
  const [records, setRecords] = useState(allRecords);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const [filterMode, setFilterMode] = useState<'MONTH' | 'CUSTOM'>('MONTH');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [time, setTime] = useState('');
  const [nowTick, setNowTick] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    setTodayAtt(initialTodayAttendance);
    setRecords(allRecords);
  }, [initialTodayAttendance, allRecords]);

  // Live ticking clock
  useEffect(() => {
    setMounted(true);
    const update = () => {
      const current = new Date();
      setNowTick(current);
      setTime(
        current.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time synchronization via SSE (strictly isolated to current user)
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.type === 'ATTENDANCE_UPDATE') {
        const att = custom.detail.payload?.attendance;
        if (!att) return;

        // Ignore events for other users
        if (currentUserId && att.userId !== currentUserId) {
          return;
        }

        setTodayAtt(att);
        setRecords((prev) => {
          const idx = prev.findIndex((r) => r.id === att.id || (r.userId === att.userId && getIndiaDateKey(r.date) === getIndiaDateKey(att.date)));
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = att;
            return copy;
          }
          return [att, ...prev];
        });
      }
    };
    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [currentUserId]);


  // Punch in / out actions
  const handleCheckIn = async () => {
    setLoading(true);
    try {
      let coords = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, { maximumAge: 60000, timeout: 5000 });
          });
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {}
      }

      const res = await fetch('/api/attendance/check-in-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coords }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success('Punched in successfully!');
        setTodayAtt(data.data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('persevex-realtime', {
              detail: { type: 'ATTENDANCE_UPDATE', payload: { status: 'CHECKED_IN', attendance: data.data } },
            })
          );
        }
      } else {
        toast.error(data?.error || data?.message || 'Check-in failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/check-in-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'checkout' }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success('Punched out successfully!');
        setTodayAtt(data.data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('persevex-realtime', {
              detail: { type: 'ATTENDANCE_UPDATE', payload: { status: 'CHECKED_OUT', attendance: data.data } },
            })
          );
        }
      } else {
        toast.error(data?.error || data?.message || 'Check-out failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Check-out failed');
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn = Boolean(todayAtt?.checkInTime);
  const isCheckedOut = Boolean(todayAtt?.checkOutTime);

  const formatYMD = (d: any) => getIndiaDateKey(d);


  const monthOptions = [
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' },
  ];

  // Calculate live current shift duration for today (HH:MM:SS)
  const todayLiveDuration = useMemo(() => {
    if (!todayAtt?.checkInTime) return '00h 00m 00s';
    if (todayAtt?.checkOutTime) {
      return formatDurationHMSFormatted(todayAtt.checkInTime, todayAtt.checkOutTime);
    }
    return formatDurationHMSFormatted(todayAtt.checkInTime, null, nowTick);
  }, [todayAtt, nowTick]);


  // Calculate daily dataset with explicit status colors for every day
  const { trendData, stats } = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const daysList: any[] = [];

    let startDate: Date;
    let daysCount: number;

    if (filterMode === 'CUSTOM' && customStart && customEnd) {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
        startDate = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
        daysCount = Math.min(31, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      } else {
        startDate = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
        daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      }
    } else {
      startDate = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
      daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    }

    let totalPresents = 0;
    let totalOnTime = 0;
    let totalLate = 0;
    let totalLeave = 0;
    let totalAbsent = 0;
    let sumHours = 0;
    let workingDaysCount = 0;

    for (let i = 0; i < daysCount; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i, 0, 0, 0, 0);
      const dateKey = formatYMD(d);
      const isToday = dateKey === formatYMD(nowTick);
      const isPastOrToday = d <= nowTick;
      const isWed = d.getDay() === 3; // Wednesday off

      const rec = records.find((r) => formatYMD(new Date(r.date)) === dateKey) || (isToday ? todayAtt : null);

      let status = 'ABSENT';
      let hours = 0;
      let lateStatus = 'ON_TIME';

      if (isWed) {
        status = 'OFF';
      } else if (isPastOrToday) {
        workingDaysCount++;
      }

      if (rec) {
        lateStatus = rec.lateStatus || 'ON_TIME';

        if (rec.checkOutTime && rec.totalHours) {
          hours = Number(rec.totalHours) || 0;
        } else if (rec.checkInTime) {
          const cIn = new Date(rec.checkInTime);
          const diffMs = nowTick.getTime() - cIn.getTime();
          hours = parseFloat((Math.max(0, diffMs) / (1000 * 60 * 60)).toFixed(2));
        }

        if (rec.status === 'ON_LEAVE') {
          status = 'LEAVE';
          totalLeave++;
        } else if (rec.status === 'PRESENT' || rec.status === 'HALF_DAY' || rec.checkInTime) {
          status = 'PRESENT';
          totalPresents++;
          sumHours += hours;
          if (lateStatus === 'LATE') {
            totalLate++;
          } else {
            totalOnTime++;
          }
        }
      } else if (!isWed && isPastOrToday) {
        status = 'ABSENT';
        totalAbsent++;
      }

      daysList.push({
        dateObj: d,
        dateKey,
        dayLabel: `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}`,
        fullFormattedDate: `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`,
        dayNumber: d.getDate(),
        hours,
        status,
        lateStatus,
        isToday,
        isWed,
        isPastOrToday,
        record: rec,
      });
    }

    return {
      trendData: daysList,
      stats: {
        totalPresents,
        totalOnTime,
        totalLate,
        totalLeave,
        totalAbsent,
        workingDaysCount,
      },
    };
  }, [records, todayAtt, nowTick, filterMode, selectedMonth, selectedYear, customStart, customEnd]);

  const targetShiftHours = 9.0;

  return (
    <div className="space-y-4 transition-colors duration-200">
      {/* ========================================================================= */}
      {/* 1. TOP LIVE ATTENDANCE PUNCH CLOCK STRIP                                  */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Live Clock & Shift Status */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight" suppressHydrationWarning>
                {mounted ? time : '--:--:--'}
              </span>
              {isCheckedIn && isCheckedOut ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                  <Check className="w-3.5 h-3.5" /> Shift Completed
                </span>
              ) : isCheckedIn ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> On Duty
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px]">
                  <Clock className="w-3.5 h-3.5" /> Ready for Punch-in
                </span>
              )}
            </div>
          </div>

          {/* Timestamps Pill */}
          <div className="flex items-center gap-3 text-xs font-mono bg-slate-50 dark:bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-sans font-bold">In: </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {mounted && todayAtt?.checkInTime ? formatTime(todayAtt.checkInTime) : '--:--'}
              </span>
            </div>
            <span className="text-slate-200 dark:text-slate-800">|</span>
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-sans font-bold">Out: </span>
              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                {mounted && todayAtt?.checkOutTime ? formatTime(todayAtt.checkOutTime) : '--:--'}
              </span>
            </div>
            <span className="text-slate-200 dark:text-slate-800">|</span>
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-sans font-bold">Duration: </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono" suppressHydrationWarning>
                {mounted ? todayLiveDuration : '00h 00m 00s'}
              </span>
            </div>

          </div>

          {/* Punch Buttons */}
          <div className="flex items-center gap-2">
            <button
              disabled={isCheckedIn || loading}
              onClick={handleCheckIn}
              className="py-2 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              {loading && !isCheckedIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{isCheckedIn ? 'Punched In' : 'Clock In'}</span>
            </button>

            <button
              disabled={!isCheckedIn || isCheckedOut || loading}
              onClick={handleCheckOut}
              className="py-2 px-4 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              {loading && isCheckedIn && !isCheckedOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{isCheckedOut ? 'Completed' : 'Clock Out'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DUAL ANALYTICS GRID (EVERY PAST DAY HAS A CLEAR VISIBLE BAR)           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left (2 Cols): MY ATTENDANCE & WORKING HOURS CHART */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-mono">
                  ATTENDANCE TREND
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  My Attendance & Working Hours
                </h3>
              </div>

              {/* Month / Custom Range Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
                  <button
                    onClick={() => setFilterMode('MONTH')}
                    className={`px-2.5 py-1 rounded-lg transition ${filterMode === 'MONTH' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setFilterMode('CUSTOM')}
                    className={`px-2.5 py-1 rounded-lg transition ${filterMode === 'CUSTOM' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Custom Range
                  </button>
                </div>

                {filterMode === 'MONTH' ? (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-500 cursor-pointer"
                  >
                    {monthOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label} {selectedYear}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs animate-in fade-in duration-150">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-800 dark:text-slate-200 font-mono"
                    />
                    <span className="text-slate-400 font-mono">→</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Clean Bar Chart (Every day has a clear visible status bar!) */}
            <div className="h-44 sm:h-48 flex items-end justify-between gap-1 sm:gap-1.5 px-1 pt-2 overflow-hidden">
              {trendData.map((d: any) => {
                const isHovered = hoveredDate === d.dateKey;

                let heightPct = 0;
                let barColor = 'bg-slate-200 dark:bg-slate-800';
                let statusText = 'Absent';

                if (d.status === 'PRESENT') {
                  heightPct = Math.min(100, Math.max(15, Math.round((d.hours / targetShiftHours) * 100)));
                  barColor = 'bg-emerald-500 shadow-emerald-500/20'; // 🟢 Present (Green)
                  statusText = d.lateStatus === 'LATE' ? 'Present (Late Arrival)' : 'Present (On-Time)';
                } else if (d.status === 'LEAVE') {
                  heightPct = 100;
                  barColor = 'bg-purple-500 shadow-purple-500/20'; // 🟣 Leave (Purple)
                  statusText = 'Approved Leave';
                } else if (d.status === 'ABSENT' && d.isPastOrToday) {
                  heightPct = 85; // Solid visible Red Bar for past absent days
                  barColor = 'bg-rose-500/90 shadow-rose-500/20'; // 🔴 Absent (Red)
                  statusText = 'Unexcused Absence';
                } else if (d.isWed) {
                  statusText = 'Off (Wednesday)';
                  heightPct = 0;
                }

                return (
                  <div
                    key={d.dateKey}
                    onMouseEnter={() => setHoveredDate(d.dateKey)}
                    onMouseLeave={() => setHoveredDate(null)}
                    className="flex-1 flex flex-col items-center gap-1 h-full justify-end group cursor-pointer relative min-w-0"
                  >
                    {/* Tooltip on Hover */}
                    {isHovered && (
                      <div className="absolute bottom-full mb-3 z-40 bg-slate-950 text-white border border-slate-800 p-3 rounded-2xl shadow-2xl text-[11px] min-w-[160px] pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                        <div className="font-bold border-b border-slate-800 pb-1 mb-1.5 flex justify-between">
                          <span>{d.fullFormattedDate}</span>
                          {d.isToday && <span className="text-emerald-400 text-[9px] font-bold">TODAY</span>}
                        </div>
                        <div className="space-y-1">
                          <p className="flex justify-between">
                            <span className="text-slate-400">Status:</span>
                            <strong className="text-emerald-400 font-semibold">{statusText}</strong>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-slate-400">Duration:</span>
                            <strong className="text-white font-mono">{d.hours} hrs {d.isToday && !d.record?.checkOutTime ? '(Live)' : ''}</strong>
                          </p>
                          {d.record?.checkInTime && (
                            <p className="flex justify-between">
                              <span className="text-slate-400">Check In:</span>
                              <span className="font-mono text-emerald-400 font-bold">{formatTime(d.record.checkInTime)}</span>
                            </p>
                          )}
                          {d.record?.checkOutTime && (
                            <p className="flex justify-between">
                              <span className="text-slate-400">Check Out:</span>
                              <span className="font-mono text-amber-400 font-bold">{formatTime(d.record.checkOutTime)}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Single Bar Track */}
                    <div
                      className={`w-full rounded-xl h-full flex flex-col-reverse p-0.5 relative transition-all ${
                        d.isToday
                          ? 'bg-emerald-500/10 ring-2 ring-emerald-500/40'
                          : 'bg-slate-100 dark:bg-slate-950'
                      }`}
                    >
                      {heightPct > 0 ? (
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-lg transition-all duration-300 shadow-sm ${barColor}`}
                        />
                      ) : (
                        <div className="w-full h-1 rounded bg-slate-200 dark:bg-slate-800 my-auto" />
                      )}
                    </div>

                    {/* Day Number */}
                    <span className={`text-[9px] font-mono font-bold block mt-0.5 ${
                      d.isToday ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'
                    }`}>
                      {d.dayNumber}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Legend */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Absent</span>
            </div>
          </div>
        </div>

        {/* Right (1 Col): STATUS DISTRIBUTION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                  STATUS DISTRIBUTION
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  Shift Compliance
                </h3>
              </div>
              <PieChart className="w-4 h-4 text-slate-400" />
            </div>

            {/* Horizontal Progress Bars */}
            <div className="space-y-3.5">
              {/* On-Time Arrival */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> On-Time (By 11:15 AM)
                  </span>
                  <span className="text-slate-900 dark:text-white font-mono">{stats.totalOnTime}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.workingDaysCount > 0 ? (stats.totalOnTime / stats.workingDaysCount) * 100 : 0}%` }}
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* Late Arrivals */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Late Arrivals
                  </span>
                  <span className="text-slate-900 dark:text-white font-mono">{stats.totalLate}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.workingDaysCount > 0 ? (stats.totalLate / stats.workingDaysCount) * 100 : 0}%` }}
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* Approved Leaves */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" /> Approved Leaves
                  </span>
                  <span className="text-slate-900 dark:text-white font-mono">{stats.totalLeave}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.workingDaysCount > 0 ? (stats.totalLeave / stats.workingDaysCount) * 100 : 0}%` }}
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* Missed / Absences */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Missed / Unexcused
                  </span>
                  <span className="text-slate-900 dark:text-white font-mono">{stats.totalAbsent}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.workingDaysCount > 0 ? (stats.totalAbsent / stats.workingDaysCount) * 100 : 0}%` }}
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-4 text-center">
            <span className="text-[10px] text-slate-400 font-mono">
              Calculated over {stats.workingDaysCount} scheduled working days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}