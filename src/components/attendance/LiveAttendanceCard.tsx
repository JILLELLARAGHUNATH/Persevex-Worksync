'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Sparkles,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function LiveAttendanceCard({ initialAttendance }: { initialAttendance: any }) {
  const [time, setTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState(initialAttendance);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAttendance(initialAttendance);
  }, [initialAttendance]);

  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail?.type === 'ATTENDANCE_UPDATE' && detail.payload?.attendance) {
          const att = detail.payload.attendance;
          if (att.id === attendance?.id || att.userId === attendance?.userId) {
            setAttendance(att);
          }
        }
      } catch {}
    };
    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [attendance?.id, attendance?.userId]);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
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

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      let coords = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, { maximumAge: 60000, timeout: 6000 });
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
        toast.success('Punch in recorded successfully!');
        setAttendance(data.data);
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
        toast.success('Punch out recorded successfully!');
        setAttendance(data.data);
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

  const formatTimestamp = (date: any) => {
    if (!date) return '--:--';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isCheckedIn = Boolean(attendance?.checkInTime);
  const isCheckedOut = Boolean(attendance?.checkOutTime);

  const getStatusBadge = () => {
    if (isCheckedIn && isCheckedOut) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
          <CheckCircle2 className="w-3 h-3" /> Shift Completed
        </span>
      );
    }
    if (isCheckedIn) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] animate-pulse">
          <Sparkles className="w-3 h-3" /> Currently On Duty
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[10px] border border-slate-200 dark:border-slate-700">
        <Clock className="w-3 h-3" /> Ready for Check-in
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors">
      {/* Left: Clock & Date info */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono tracking-tight" suppressHydrationWarning>
              {mounted ? time : '--:--:--'}
            </span>
            {getStatusBadge()}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium" suppressHydrationWarning>
            {mounted ? new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Today'} &middot; Main Shift: 11:00 AM – 8:00 PM (15m Grace)
          </p>
        </div>
      </div>

      {/* Right: Metrics & Compact Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
        {/* Compact Punch In/Out/Duration info */}
        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">In: </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400" suppressHydrationWarning>
              {mounted ? formatTimestamp(attendance?.checkInTime) : '--:--'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Out: </span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400" suppressHydrationWarning>
              {mounted ? formatTimestamp(attendance?.checkOutTime) : '--:--'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Duration: </span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {attendance?.totalHours ? `${attendance.totalHours} hrs` : '0.00 hrs'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            disabled={isCheckedIn || loading}
            onClick={handleCheckIn}
            className="py-1.5 px-3.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            {loading && !isCheckedIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{isCheckedIn ? 'Punched In' : 'Clock In'}</span>
          </button>

          <button
            disabled={!isCheckedIn || isCheckedOut || loading}
            onClick={handleCheckOut}
            className="py-1.5 px-3.5 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            {loading && isCheckedIn && !isCheckedOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
            <span>{isCheckedOut ? 'Completed' : 'Clock Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}