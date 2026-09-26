'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
  LogOut as LogOutIcon,
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

  const targetUserId = currentUserId || initialAttendance?.userId;

  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;

        if (detail.type === 'ATTENDANCE_UPDATE') {
          const att = detail.payload?.attendance;
          const status = detail.payload?.status;
          const userId = detail.payload?.userId || att?.userId;

          if (!targetUserId || userId !== targetUserId) return;

          if (status === 'ATTENDANCE_DELETED' || (!att && userId)) {
            setAttendance(null);
            return;
          }
          if (att) setAttendance(att);
        } else if (detail.type === 'SNAPSHOT_SYNC' && detail.snapshot?.todayAttendanceMap) {
          if (targetUserId) {
            const snap = detail.snapshot.todayAttendanceMap[targetUserId];
            if (snap) {
              setAttendance((prev: any) => ({ ...(prev || {}), ...snap }));
            } else {
              setAttendance(null);
            }
          }
        }
      } catch (error) {
        console.error('Realtime attendance update error:', error);
      }
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [targetUserId]);

  const [nowTick, setNowTick] = useState<Date>(new Date());

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

  const handleCheckIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const locResult = await getBrowserLocation();
      if (locResult.isDenied || !locResult.coords) {
        toast.error(locResult.error || 'Location access is required to check in. Please allow location access in your browser.');
        return;
      }
      const res = await fetch('/api/attendance/check-in-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ coords: locResult.coords }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.success) {
        toast.success('Punch in recorded successfully!');
        setAttendance(data.data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('persevex-realtime', {
            detail: { type: 'ATTENDANCE_UPDATE', payload: { status: 'CHECKED_IN', attendance: data.data } },
          }));
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
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ op: 'checkout', coords: locResult.coords }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.success) {
        toast.success('Punch out recorded successfully!');
        setAttendance(data.data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('persevex-realtime', {
            detail: { type: 'ATTENDANCE_UPDATE', payload: { status: 'CHECKED_OUT', attendance: data.data } },
          }));
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
    if (!date) return '--:--';
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const isCheckedIn = Boolean(attendance?.checkInTime);
  const isCheckedOut = Boolean(attendance?.checkOutTime);

  /* ─────────────────── Render ─────────────────── */
  return (
    <div className={`ws-checkin-hero ${
      isCheckedIn && isCheckedOut
        ? 'ws-checkin-hero-done'
        : isCheckedIn
        ? 'ws-checkin-hero-working'
        : 'ws-checkin-hero-idle'
    } p-4 sm:p-5`}>
      <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Left: icon + time + status */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-md">
            {isCheckedIn && isCheckedOut ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : isCheckedIn ? (
              <span className="text-2xl">⏱</span>
            ) : (
              <Clock className="w-6 h-6 text-white/80" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg sm:text-xl font-black text-white font-mono tracking-tight tabular-nums" suppressHydrationWarning>
                {mounted ? time : '--:--:--'}
              </span>
              {isCheckedIn && !isCheckedOut && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-white/90 bg-white/15 px-2 py-0.5 rounded-full border border-white/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-white ws-pulse-dot" />
                  ACTIVE
                </span>
              )}
            </div>

            {/* State badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-white/15 text-white border border-white/25">
              {isCheckedIn && isCheckedOut ? 'Shift Completed' : isCheckedIn ? 'On Duty' : 'Not Checked In'}
            </span>

            <p className="text-[11px] text-white/60 mt-1" suppressHydrationWarning>
              {mounted
                ? new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : 'Today'}{' '}
              · Shift: 11:00 AM – 8:00 PM
            </p>
          </div>
        </div>

        {/* Right: Times + Buttons */}
        <div className="flex flex-col gap-2.5 shrink-0 w-full sm:w-auto">
          {/* Punch info strip */}
          <div className="flex items-center gap-3 text-xs font-mono bg-white/10 rounded-xl px-3 py-2 border border-white/20">
            <div className="text-center flex-1">
              <p className="text-white/60 text-[10px] uppercase tracking-wider font-sans mb-0.5">In</p>
              <p className="font-bold text-white" suppressHydrationWarning>
                {mounted ? formatTimestamp(attendance?.checkInTime) : '--:--'}
              </p>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="text-center flex-1">
              <p className="text-white/60 text-[10px] uppercase tracking-wider font-sans mb-0.5">Out</p>
              <p className="font-bold text-white" suppressHydrationWarning>
                {mounted ? formatTimestamp(attendance?.checkOutTime) : '--:--'}
              </p>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="text-center flex-1">
              <p className="text-white/60 text-[10px] uppercase tracking-wider font-sans mb-0.5">Duration</p>
              <p className="font-bold text-white" suppressHydrationWarning>
                {mounted ? liveDurationHMS : '00h 00m'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              disabled={isCheckedIn || loading}
              onClick={handleCheckIn}
              className="flex-1 h-9 px-3 rounded-xl font-bold text-sm bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-black/20 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {loading && !isCheckedIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {isCheckedIn ? 'Punched In' : 'Clock In'}
            </button>
            <button
              disabled={!isCheckedIn || isCheckedOut || loading}
              onClick={handleCheckOut}
              className="flex-1 h-9 px-3 rounded-xl font-bold text-sm bg-white/15 hover:bg-white/25 border border-white/30 text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {loading && isCheckedIn && !isCheckedOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOutIcon className="w-4 h-4" />}
              {isCheckedOut ? 'Completed' : 'Clock Out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
