'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDurationHMSFormatted } from '@/lib/utils';
import { getBrowserLocation } from '@/lib/location';


export default function LiveAttendanceCard({
  initialAttendance,
  currentUserId,
}: {
  initialAttendance: any;
  currentUserId?: string;
}) {
  const [time, setTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState(initialAttendance);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (initialAttendance) {
      setAttendance((prev: any) => {
        if (prev?.checkOutTime && !initialAttendance.checkOutTime) return prev;
        if (prev?.checkInTime && !initialAttendance.checkInTime) return prev;
        return initialAttendance;
      });
    }
  }, [initialAttendance]);

  // Resolve the target user ID for this component instance
  const targetUserId = currentUserId || initialAttendance?.userId;

  /*
   * Realtime event support with strict user isolation.
   */
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;

        if (
          detail?.type === 'ATTENDANCE_UPDATE' &&
          detail.payload?.attendance
        ) {
          const att = detail.payload.attendance;

          // Strictly ignore events that do not belong to this employee
          if (!targetUserId || !att.userId || att.userId !== targetUserId) {
            return;
          }

          setAttendance(att);
        }
      } catch (error) {
        console.error('Realtime attendance update error:', error);
      }
    };

    window.addEventListener('persevex-realtime', handleRealtime);

    return () => {
      window.removeEventListener('persevex-realtime', handleRealtime);
    };
  }, [targetUserId]);

  const [nowTick, setNowTick] = useState<Date>(new Date());

  /*
   * Live clock and second-by-second ticker.
   */
  useEffect(() => {
    setMounted(true);

    const updateTime = () => {
      const now = new Date();
      setNowTick(now);

      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };

    updateTime();

    const timer = setInterval(updateTime, 1000);

    return () => clearInterval(timer);
  }, []);

  const liveDurationHMS = useMemo(() => {
    if (!attendance?.checkInTime) return '00h 00m 00s';
    if (attendance?.checkOutTime) {
      return formatDurationHMSFormatted(attendance.checkInTime, attendance.checkOutTime);
    }
    return formatDurationHMSFormatted(attendance.checkInTime, null, nowTick);
  }, [attendance, nowTick]);

  /*
   * CLOCK IN
   */
  const handleCheckIn = async () => {
    setLoading(true);

    try {
      const locResult = await getBrowserLocation();
      if (locResult.isDenied || !locResult.coords) {
        toast.error(locResult.error || 'Location access is required to check in. Please allow location access in your browser.');
        setLoading(false);
        return;
      }
      const coords = locResult.coords;

      const res = await fetch('/api/attendance/check-in-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ coords }),
        cache: 'no-store',
      });

      const data = await res.json();

      if (data?.success) {
        toast.success('Punch in recorded successfully!');
        setAttendance(data.data);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('persevex-realtime', {
              detail: {
                type: 'ATTENDANCE_UPDATE',
                payload: {
                  status: 'CHECKED_IN',
                  attendance: data.data,
                },
              },
            })
          );
        }
      } else {
        if (data?.data && data?.error?.toLowerCase().includes('already checked in')) {
          setAttendance(data.data);
        }
        toast.error(data?.error || data?.message || (locResult.error ? locResult.error : 'Check-in failed'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  /*
   * CLOCK OUT
   */
  const handleCheckOut = async () => {
    setLoading(true);

    try {
      const locResult = await getBrowserLocation();
      if (locResult.isDenied || !locResult.coords) {
        toast.error(locResult.error || 'Location access is required to check out. Please allow location access in your browser.');
        return;
      }

      const res = await fetch('/api/attendance/check-in-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          op: 'checkout',
          coords: locResult.coords,
        }),
        cache: 'no-store',
      });

      const data = await res.json();

      if (data?.success) {
        toast.success('Punch out recorded successfully!');
        setAttendance(data.data);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('persevex-realtime', {
              detail: {
                type: 'ATTENDANCE_UPDATE',
                payload: {
                  status: 'CHECKED_OUT',
                  attendance: data.data,
                },
              },
            })
          );
        }
      } else {
        if (data?.data && data?.error?.toLowerCase().includes('already completed clock-out')) {
          setAttendance(data.data);
        }
        toast.error(data?.error || data?.message || 'Check-out failed');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Check-out failed');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (date: any) => {
    if (!date) {
      return '--:--';
    }

    const d = new Date(date);

    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  /*
   * Attendance state.
   */
  const isCheckedIn = Boolean(attendance?.checkInTime);
  const isCheckedOut = Boolean(attendance?.checkOutTime);

  const getStatusBadge = () => {
    if (isCheckedIn && isCheckedOut) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 font-semibold text-[10px] border border-emerald-200 dark:border-emerald-800/60">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          Shift Completed
        </span>
      );
    }

    if (isCheckedIn) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 font-semibold text-[10px] border border-blue-200 dark:border-blue-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Currently On Duty
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px] border border-slate-200 dark:border-slate-700">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Ready for Check-in
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 sm:px-5 py-3 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors">
      {/* Left: Clock and Date */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
          <Clock className="w-4 h-4" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight"
              suppressHydrationWarning
            >
              {mounted ? time : '--:--:--'}
            </span>
            {getStatusBadge()}
          </div>

          <p
            className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"
            suppressHydrationWarning
          >
            {mounted
              ? new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              : 'Today'}{' '}
            &middot; Main Shift: 11:00 AM – 8:00 PM (15m Grace)
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
        {/* Punch Information */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-medium">In: </span>
            <span
              className="font-mono font-semibold text-emerald-600 dark:text-emerald-400"
              suppressHydrationWarning
            >
              {mounted ? formatTimestamp(attendance?.checkInTime) : '--:--'}
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-600">|</span>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-medium">Out: </span>
            <span
              className="font-mono font-semibold text-amber-600 dark:text-amber-400"
              suppressHydrationWarning
            >
              {mounted ? formatTimestamp(attendance?.checkOutTime) : '--:--'}
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-600">|</span>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-medium">Duration: </span>
            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400" suppressHydrationWarning>
              {mounted ? liveDurationHMS : '00h 00m 00s'}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5">
          {/* CLOCK IN */}
          <button
            disabled={isCheckedIn || loading}
            onClick={handleCheckIn}
            className="h-8 px-3 rounded-lg font-medium text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {loading && !isCheckedIn ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{isCheckedIn ? 'Punched In' : 'Clock In'}</span>
          </button>

          {/* CLOCK OUT */}
          <button
            disabled={!isCheckedIn || isCheckedOut || loading}
            onClick={handleCheckOut}
            className="h-8 px-3 rounded-lg font-medium text-xs text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {loading && isCheckedIn && !isCheckedOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <span>{isCheckedOut ? 'Completed' : 'Clock Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
