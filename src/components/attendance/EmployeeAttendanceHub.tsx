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
  LogOut,
  CalendarDays,
  RotateCcw
} from 'lucide-react';
import { formatDate, formatTime, getIndiaDateKey, formatDurationHMSFormatted } from '@/lib/utils';
import { getYesterdayIndiaDateKey } from '@/lib/attendanceDate';
import { getBrowserLocation } from '@/lib/location';
import { toast } from 'sonner';

const EMPTY_ARRAY: any[] = [];

interface Props {
  initialTodayAttendance: any;
  allRecords?: any[];
  holidays?: any[];
  currentUserId?: string;
}

export default function EmployeeAttendanceHub({
  initialTodayAttendance,
  allRecords = EMPTY_ARRAY,
  currentUserId,
}: Props) {
  const [todayAtt, setTodayAtt] = useState(initialTodayAttendance);
  const [records, setRecords] = useState(allRecords);

  const currentDate = new Date();
  const [dayPreset, setDayPreset] = useState<'TODAY' | 'YESTERDAY' | 'DATE'>('TODAY');
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>(getIndiaDateKey(currentDate));

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

  // Resolve target user ID for this component instance
  const targetUserId = currentUserId || initialTodayAttendance?.userId || (allRecords && allRecords[0]?.userId);

  // Real-time synchronization via SSE / Fast Sync (strictly isolated to current user)
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      const custom = e as CustomEvent;
      const detail = custom.detail;
      if (!detail) return;

      if (detail.type === 'ATTENDANCE_UPDATE') {
        const att = detail.payload?.attendance;
        const status = detail.payload?.status;
        const userId = detail.payload?.userId || att?.userId;
        const todayKey = getIndiaDateKey(new Date());

        // Strictly ignore events that do not belong to this employee
        if (!targetUserId || userId !== targetUserId) {
          return;
        }

        if (status === 'ATTENDANCE_DELETED' || (!att && userId)) {
          setTodayAtt(null);
          setRecords((prev) =>
            prev.filter(
              (r) =>
                !(r.userId === targetUserId && getIndiaDateKey(r.date) === todayKey)
            )
          );
          return;
        }

        if (att) {
          setTodayAtt(att);
          setRecords((prev) => {
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
      } else if (detail.type === 'SNAPSHOT_SYNC' && detail.snapshot?.todayAttendanceMap) {
        if (targetUserId) {
          const snap = detail.snapshot.todayAttendanceMap[targetUserId];
          if (snap) {
            setTodayAtt((prev: any) => ({ ...(prev || {}), ...snap }));
          } else {
            setTodayAtt(null);
          }
        }
      }
    };
    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [targetUserId]);


  // Punch in / out actions
  const handleCheckIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const locResult = await getBrowserLocation();
      if (locResult.isDenied || !locResult.coords) {
        toast.error(locResult.error || 'Location access is required to check in. Please allow location access in your browser.');
        return;
      }
      const coords = locResult.coords;

      const res = await fetch('/api/attendance/check-in-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coords }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success('Punched in successfully!');
        setTodayAtt(data.data);
        setRecords((prev) => {
          const idx = prev.findIndex((r) => r.id === data.data.id || (r.userId === data.data.userId && getIndiaDateKey(r.date) === getIndiaDateKey(data.data.date)));
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = data.data;
            return copy;
          }
          return [data.data, ...prev];
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('persevex-realtime', {
              detail: { type: 'ATTENDANCE_UPDATE', payload: { status: 'CHECKED_IN', attendance: data.data } },
            })
          );
        }
      } else {
        if (data?.data && data?.error?.toLowerCase().includes('already checked in')) {
          setTodayAtt(data.data);
        }
        toast.error(data?.error || data?.message || (locResult.error ? locResult.error : 'Check-in failed'));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const locResult = await getBrowserLocation();
      if (locResult.isDenied || !locResult.coords) {
        toast.error(locResult.error || 'Location access is required to check out. Please allow location access in your browser.');
        return;
      }

      const res = await fetch('/api/attendance/check-in-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'checkout', coords: locResult.coords }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success('Punched out successfully!');
        setTodayAtt(data.data);
        setRecords((prev) => {
          const idx = prev.findIndex((r) => r.id === data.data.id || (r.userId === data.data.userId && getIndiaDateKey(r.date) === getIndiaDateKey(data.data.date)));
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = data.data;
            return copy;
          }
          return [data.data, ...prev];
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('persevex-realtime', {
              detail: { type: 'ATTENDANCE_UPDATE', payload: { status: 'CHECKED_OUT', attendance: data.data } },
            })
          );
        }
      } else {
        if (data?.data && data?.error?.toLowerCase().includes('already completed clock-out')) {
          setTodayAtt(data.data);
        }
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

  const todayDateKey = getIndiaDateKey(nowTick);
  const yesterdayDateKey = getYesterdayIndiaDateKey(nowTick);

  const activeDateKey = useMemo(() => {
    if (dayPreset === 'TODAY') return todayDateKey;
    if (dayPreset === 'YESTERDAY') return yesterdayDateKey;
    return selectedSingleDate || todayDateKey;
  }, [dayPreset, selectedSingleDate, todayDateKey, yesterdayDateKey]);

  const isViewingToday = activeDateKey === todayDateKey;

  // The specific record for the active date (today or historical)
  const activeDayRecord = useMemo(() => {
    if (isViewingToday) {
      return todayAtt;
    }
    return records.find((r) => getIndiaDateKey(r.date) === activeDateKey) || null;
  }, [isViewingToday, todayAtt, records, activeDateKey]);

  // Active status badge for selected day
  const activeDayStatus = useMemo(() => {
    if (isViewingToday) {
      if (todayAtt?.checkInTime && todayAtt?.checkOutTime) return { label: 'Shift Completed', color: 'emerald' };
      if (todayAtt?.checkInTime) return { label: 'On Duty', color: 'blue' };
      return { label: 'Ready for Check-in', color: 'slate' };
    }

    if (!activeDayRecord) {
      const parts = activeDateKey.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (d.getDay() === 3) {
          return { label: 'Weekly Off (Wed)', color: 'slate' };
        }
      }
      return { label: 'Absent', color: 'rose' };
    }

    if (activeDayRecord.status === 'ON_LEAVE') return { label: 'Approved Leave', color: 'violet' };
    if (activeDayRecord.checkInTime && activeDayRecord.checkOutTime) {
      return {
        label: activeDayRecord.lateStatus === 'LATE' ? 'Completed (Late)' : 'Shift Completed',
        color: activeDayRecord.lateStatus === 'LATE' ? 'amber' : 'emerald',
      };
    }
    if (activeDayRecord.checkInTime) return { label: 'Punched In', color: 'blue' };
    return { label: 'Absent', color: 'rose' };
  }, [isViewingToday, todayAtt, activeDayRecord, activeDateKey]);

  const activeInDisplay = useMemo(() => {
    if (isViewingToday) {
      return mounted && todayAtt?.checkInTime ? formatTime(todayAtt.checkInTime) : '--:--';
    }
    return activeDayRecord?.checkInTime ? formatTime(activeDayRecord.checkInTime) : '--:--';
  }, [isViewingToday, mounted, todayAtt, activeDayRecord]);

  const activeOutDisplay = useMemo(() => {
    if (isViewingToday) {
      return mounted && todayAtt?.checkOutTime ? formatTime(todayAtt.checkOutTime) : '--:--';
    }
    return activeDayRecord?.checkOutTime ? formatTime(activeDayRecord.checkOutTime) : '--:--';
  }, [isViewingToday, mounted, todayAtt, activeDayRecord]);

  const activeDurationDisplay = useMemo(() => {
    if (isViewingToday) {
      return mounted ? todayLiveDuration : '00h 00m 00s';
    }
    if (activeDayRecord?.checkInTime && activeDayRecord?.checkOutTime) {
      return formatDurationHMSFormatted(activeDayRecord.checkInTime, activeDayRecord.checkOutTime, activeDayRecord.totalHours);
    }
    if (activeDayRecord?.totalHours) {
      return `${activeDayRecord.totalHours}h`;
    }
    return '00h 00m 00s';
  }, [isViewingToday, mounted, todayLiveDuration, activeDayRecord]);


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
    <div className="space-y-4 ws-animate-fade-up">
      {/* ========================================================================= */}
      {/* 0. FILTER TOOLBAR: TODAY, YESTERDAY, SELECT DATE                          */}
      {/* ========================================================================= */}
      <div className="ws-card px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {(['TODAY', 'YESTERDAY', 'DATE'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setDayPreset(preset)}
                className={`px-2.5 py-1 rounded-md transition text-xs font-medium cursor-pointer ${
                  dayPreset === preset
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {preset === 'TODAY' ? 'Today' : preset === 'YESTERDAY' ? 'Yesterday' : 'Select Date'}
              </button>
            ))}
          </div>

          {/* Specific Date Picker */}
          {dayPreset === 'DATE' && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
              <input
                type="date"
                value={selectedSingleDate}
                onChange={(e) => setSelectedSingleDate(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Viewing: <strong className="text-slate-900 dark:text-slate-100 font-semibold">{dayPreset === 'TODAY' ? 'Today' : dayPreset === 'YESTERDAY' ? 'Yesterday' : activeDateKey}</strong>
          </span>
          {dayPreset !== 'TODAY' && (
            <button
              onClick={() => {
                setDayPreset('TODAY');
                setSelectedSingleDate(todayDateKey);
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Back to Today
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TOP HERO: ATTENDANCE PUNCH & SHIFT OVERVIEW                            */}
      {/* ========================================================================= */}
      {/* ─── HERO CHECK-IN CARD ─── */}
      <div className={`ws-checkin-hero ${
        isCheckedIn && !isCheckedOut
          ? (activeDayStatus.color === 'amber' ? 'ws-checkin-hero-late' : 'ws-checkin-hero-working')
          : isCheckedOut
          ? 'ws-checkin-hero-done'
          : 'ws-checkin-hero-idle'
      } p-5 sm:p-7`}>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* Left: Big icon + time + status + duration */}
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-lg">
              {isCheckedIn && !isCheckedOut ? (
                <span className="text-3xl">⏱</span>
              ) : isCheckedOut ? (
                <Check className="w-8 h-8 text-white" />
              ) : (
                <Clock className="w-8 h-8 text-white/80" />
              )}
            </div>

            <div>
              {/* Live clock / date */}
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight" suppressHydrationWarning>
                  {isViewingToday ? (mounted ? time : '--:--:--') : activeDateKey}
                </span>
                {isCheckedIn && !isCheckedOut && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-white/90 bg-white/15 px-2 py-0.5 rounded-full border border-white/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-white ws-pulse-dot" />
                    ACTIVE
                  </span>
                )}
              </div>

              {/* Status badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-white/15 text-white border border-white/25">
                {activeDayStatus.label}
              </span>

              {/* Duration */}
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight" suppressHydrationWarning>
                  {activeDurationDisplay}
                </span>
                <span className="text-white/60 text-sm">worked</span>
              </div>
            </div>
          </div>

          {/* Right: Timestamps + punch buttons */}
          <div className="flex flex-col gap-3 shrink-0">
            {/* In / Out times */}
            <div className="flex items-center gap-3 text-xs font-mono bg-white/10 rounded-xl px-4 py-2.5 border border-white/20">
              <div className="text-center">
                <div className="text-white/60 text-[10px] uppercase tracking-wider font-sans mb-0.5">Check In</div>
                <div className="font-bold text-white">{activeInDisplay}</div>
              </div>
              <div className="w-px h-6 bg-white/20" />
              <div className="text-center">
                <div className="text-white/60 text-[10px] uppercase tracking-wider font-sans mb-0.5">Check Out</div>
                <div className="font-bold text-white">{activeOutDisplay}</div>
              </div>
            </div>

            {/* Punch Buttons */}
            {isViewingToday ? (
              <div className="flex items-center gap-2">
                <button
                  disabled={isCheckedIn || loading}
                  onClick={handleCheckIn}
                  className="flex-1 h-10 px-4 rounded-xl font-bold text-sm bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-black/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading && !isCheckedIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isCheckedIn ? 'Punched In' : 'Clock In'}
                </button>
                <button
                  disabled={!isCheckedIn || isCheckedOut || loading}
                  onClick={handleCheckOut}
                  className="flex-1 h-10 px-4 rounded-xl font-bold text-sm bg-white/15 hover:bg-white/25 border border-white/30 text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading && isCheckedIn && !isCheckedOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                  {isCheckedOut ? 'Completed' : 'Clock Out'}
                </button>
              </div>
            ) : (
              <span className="h-10 px-4 rounded-xl font-medium text-sm text-white/80 bg-white/10 border border-white/20 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Historical Record
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DUAL ANALYTICS GRID (ENTERPRISE PRESENTATION)                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left (2 Cols): MY ATTENDANCE & WORKING HOURS CHART */}
        <div className="lg:col-span-2 ws-card p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-mono">
                  ATTENDANCE TREND
                </span>
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  My Attendance & Working Hours
                </h3>
              </div>

              {/* Month / Custom Range Filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    onClick={() => setFilterMode('MONTH')}
                    className={`px-2 py-0.5 rounded-md transition text-xs ${filterMode === 'MONTH' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setFilterMode('CUSTOM')}
                    className={`px-2 py-0.5 rounded-md transition text-xs ${filterMode === 'CUSTOM' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Custom
                  </button>
                </div>

                {filterMode === 'MONTH' ? (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="h-7 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    {monthOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label} {selectedYear}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1 text-xs">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                    />
                    <span className="text-slate-400">&rarr;</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Clean Bar Chart */}
            <div className="h-44 sm:h-48 flex items-end justify-between gap-1 sm:gap-1.5 px-0.5 pt-2">
              {trendData.map((d: any, idx: number) => {
                const isHovered = hoveredDate === d.dateKey;

                let heightPct = 0;
                let barColor = 'bg-slate-200 dark:bg-slate-800';
                let statusLabel = 'Absent';
                let statusColorClass = 'text-rose-600 dark:text-rose-400';

                if (d.status === 'PRESENT') {
                  heightPct = Math.min(100, Math.max(15, Math.round((d.hours / targetShiftHours) * 100)));
                  barColor = 'bg-emerald-500';
                  statusLabel = d.lateStatus === 'LATE' ? 'Late' : 'Present';
                  statusColorClass = d.lateStatus === 'LATE' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
                } else if (d.status === 'LEAVE') {
                  heightPct = 100;
                  barColor = 'bg-violet-500';
                  statusLabel = 'Approved Leave';
                  statusColorClass = 'text-violet-600 dark:text-violet-400';
                } else if (d.status === 'ABSENT' && d.isPastOrToday) {
                  heightPct = 85;
                  barColor = 'bg-rose-500';
                  statusLabel = 'Absent';
                  statusColorClass = 'text-rose-600 dark:text-rose-400';
                } else if (d.isWed) {
                  statusLabel = 'Weekly Off (Wednesday)';
                  statusColorClass = 'text-slate-400';
                  heightPct = 0;
                }

                const checkInDisplay = d.record?.checkInTime
                  ? formatTime(d.record.checkInTime)
                  : d.status === 'ABSENT' && d.isPastOrToday
                  ? 'No check-in recorded'
                  : '—';

                const checkOutDisplay = d.record?.checkOutTime
                  ? formatTime(d.record.checkOutTime)
                  : d.isToday && d.record?.checkInTime
                  ? '--:--'
                  : '—';

                const durationDisplay = d.record?.checkInTime
                  ? d.record?.checkOutTime
                    ? formatDurationHMSFormatted(d.record.checkInTime, d.record.checkOutTime, d.record.totalHours)
                    : d.isToday
                    ? formatDurationHMSFormatted(d.record.checkInTime, null, nowTick) + ' (Live)'
                    : '—'
                  : '—';

                const punctualityDisplay = d.status === 'PRESENT'
                  ? d.lateStatus === 'LATE'
                    ? 'Late'
                    : 'On Time'
                  : null;

                const tooltipAlignClass = idx < 3
                  ? 'left-0'
                  : idx > trendData.length - 4
                  ? 'right-0'
                  : 'left-1/2 -translate-x-1/2';

                return (
                  <div
                    key={d.dateKey}
                    onMouseEnter={() => setHoveredDate(d.dateKey)}
                    onMouseLeave={() => setHoveredDate(null)}
                    onClick={() => {
                      setHoveredDate(hoveredDate === d.dateKey ? null : d.dateKey);
                      setSelectedSingleDate(d.dateKey);
                      setDayPreset(d.isToday ? 'TODAY' : 'DATE');
                    }}
                    className="flex-1 flex flex-col items-center gap-1 h-full justify-end group cursor-pointer relative min-w-0"
                  >
                    {/* Professional Tooltip on Hover / Touch */}
                    {isHovered && (
                      <div className={`absolute bottom-full mb-2.5 z-50 bg-[#16243A] text-white border border-[#223450] p-3 rounded-xl shadow-2xl text-xs min-w-[210px] pointer-events-none animate-in fade-in zoom-in-95 duration-100 ${tooltipAlignClass}`}>
                        <div className="font-semibold text-slate-100 border-b border-[#223450] pb-1.5 mb-2 flex items-center justify-between gap-2">
                          <span className="font-medium text-xs text-slate-200">
                            {d.dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                          {d.isToday && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              TODAY
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">Status:</span>
                            <span className={`font-semibold ${statusColorClass}`}>{statusLabel}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">Check-in:</span>
                            <span className={`font-mono ${d.record?.checkInTime ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                              {checkInDisplay}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">Check-out:</span>
                            <span className={`font-mono ${d.record?.checkOutTime ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                              {checkOutDisplay}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">Working Duration:</span>
                            <span className={`font-mono ${durationDisplay !== '—' ? 'text-blue-400 font-semibold' : 'text-slate-400'}`}>
                              {durationDisplay}
                            </span>
                          </div>

                          {punctualityDisplay && (
                            <div className="flex justify-between items-center pt-1 border-t border-[#223450]">
                              <span className="text-slate-400 font-medium">Punctuality:</span>
                              <span className={`font-semibold ${d.lateStatus === 'LATE' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {punctualityDisplay}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Single Bar Track */}
                    <div
                      className={`w-full rounded-md h-full flex flex-col-reverse p-0.5 relative transition-all ${
                        d.isToday
                          ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {heightPct > 0 ? (
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-sm transition-all duration-200 ${barColor}`}
                        />
                      ) : (
                        <div className="w-full h-0.5 rounded bg-slate-200 dark:bg-slate-700 my-auto" />
                      )}
                    </div>

                    {/* Day Number */}
                    <span className={`text-[9px] font-mono block mt-0.5 ${
                      d.isToday ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'
                    }`}>
                      {d.dayNumber}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Legend */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Absent</span>
            </div>
          </div>
        </div>

        {/* Right (1 Col): STATUS DISTRIBUTION */}
        <div className="ws-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-3.5">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                  STATUS DISTRIBUTION
                </span>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  Shift Compliance
                </h3>
              </div>
              <PieChart className="w-4 h-4 text-slate-400" />
            </div>

            {/* Horizontal Progress Bars */}
            <div className="space-y-3">
              {/* On-Time Arrival */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> On-Time (By 11:15 AM)
                  </span>
                  <span className="text-slate-900 dark:text-white font-mono font-semibold">{stats.totalOnTime}</span>
                </div>
                <div className="w-full h-1.5 bg-emerald-100 dark:bg-emerald-950/40 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.workingDaysCount > 0 ? (stats.totalOnTime / stats.workingDaysCount) * 100 : 0}%` }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* Late Arrivals */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Late Arrivals
                  </span>
                  <span className="text-slate-900 dark:text-white font-mono font-semibold">{stats.totalLate}</span>
                </div>
                <div className="w-full h-1.5 bg-amber-100 dark:bg-amber-950/40 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.workingDaysCount > 0 ? (stats.totalLate / stats.workingDaysCount) * 100 : 0}%` }}
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* Approved Leaves */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Approved Leaves
                  </span>
                  <span className="text-slate-900 dark:text-white font-mono font-semibold">{stats.totalLeave}</span>
                </div>
                <div className="w-full h-1.5 bg-violet-100 dark:bg-violet-950/40 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.workingDaysCount > 0 ? (stats.totalLeave / stats.workingDaysCount) * 100 : 0}%` }}
                    className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* Missed / Absences */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Missed / Unexcused
                  </span>
                  <span className="text-slate-900 dark:text-white font-mono font-semibold">{stats.totalAbsent}</span>
                </div>
                <div className="w-full h-1.5 bg-rose-100 dark:bg-rose-950/40 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.workingDaysCount > 0 ? (stats.totalAbsent / stats.workingDaysCount) * 100 : 0}%` }}
                    className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 mt-3 text-center">
            <span className="text-[10px] text-slate-400 font-mono">
              Calculated over {stats.workingDaysCount} scheduled working days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
