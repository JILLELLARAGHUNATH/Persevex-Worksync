'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function LiveAttendanceCard({
  initialAttendance,
}: {
  initialAttendance: any;
}) {
  const [time, setTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState(initialAttendance);
  const [mounted, setMounted] = useState(false);
  const [refreshingAttendance, setRefreshingAttendance] = useState(true);

  /*
   * IMPORTANT:
   * Always fetch the latest attendance record from the server.
   *
   * This fixes the Vercel deployment issue where initialAttendance
   * may be stale/null after logout and login.
   */
  const refreshAttendance = useCallback(async () => {
    try {
      setRefreshingAttendance(true);

      const response = await fetch('/api/attendance/check-in-out', {
        method: 'GET',

        // Prevent browser / deployment cache
        cache: 'no-store',

        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        return;
      }

      const result = await response.json();

      if (result?.success) {
        setAttendance(result.data || null);
      }
    } catch (error) {
      console.error('Failed to refresh attendance:', error);
    } finally {
      setRefreshingAttendance(false);
    }
  }, []);

  /*
   * Keep server-provided attendance,
   * but the API refresh below will always get the latest data.
   */
  useEffect(() => {
    setAttendance(initialAttendance);
  }, [initialAttendance]);

  /*
   * Fetch fresh attendance when the dashboard opens.
   *
   * This is the main fix for Vercel.
   */
  useEffect(() => {
    refreshAttendance();
  }, [refreshAttendance]);

  /*
   * Refresh attendance whenever the browser tab becomes active again.
   *
   * Example:
   * Siva checks in -> logs out -> logs in again.
   * The latest attendance is fetched from the database.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAttendance();
      }
    };

    window.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, [refreshAttendance]);

  /*
   * Existing realtime event support.
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

          setAttendance((currentAttendance: any) => {
            /*
             * If there is no current attendance,
             * accept the incoming attendance.
             */
            if (!currentAttendance) {
              return att;
            }

            /*
             * Update only if it belongs to the same user.
             */
            if (
              att.id === currentAttendance.id ||
              att.userId === currentAttendance.userId
            ) {
              return att;
            }

            return currentAttendance;
          });
        }
      } catch (error) {
        console.error('Realtime attendance update error:', error);
      }
    };

    window.addEventListener(
      'persevex-realtime',
      handleRealtime
    );

    return () => {
      window.removeEventListener(
        'persevex-realtime',
        handleRealtime
      );
    };
  }, []);

  /*
   * Live clock.
   */
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

  /*
   * CLOCK IN
   */
  const handleCheckIn = async () => {
    setLoading(true);

    try {
      let coords = null;

      if (navigator.geolocation) {
        try {
          const pos =
            await new Promise<GeolocationPosition>(
              (resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                  resolve,
                  reject,
                  {
                    maximumAge: 60000,
                    timeout: 6000,
                  }
                );
              }
            );

          coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
        } catch {
          /*
           * Location is optional depending on settings.
           */
        }
      }

      const res = await fetch(
        '/api/attendance/check-in-out',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },

          body: JSON.stringify({
            coords,
          }),

          cache: 'no-store',
        }
      );

      const data = await res.json();

      if (data?.success) {
        toast.success('Punch in recorded successfully!');

        /*
         * Immediately update local state.
         */
        setAttendance(data.data);

        /*
         * Keep existing realtime event.
         */
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

        /*
         * Fetch again from database.
         * Ensures deployed Vercel version has latest data.
         */
        await refreshAttendance();
      } else {
        /*
         * Important recovery:
         *
         * If server says "already checked in",
         * fetch the existing attendance record.
         *
         * This directly fixes Siva's issue.
         */
        if (
          data?.error?.toLowerCase().includes(
            'already checked in'
          )
        ) {
          await refreshAttendance();
        }

        toast.error(
          data?.error ||
            data?.message ||
            'Check-in failed'
        );
      }
    } catch (err: any) {
      console.error(err);

      toast.error(
        err?.message ||
          'Check-in failed'
      );
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
      const res = await fetch(
        '/api/attendance/check-in-out',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },

          body: JSON.stringify({
            op: 'checkout',
          }),

          cache: 'no-store',
        }
      );

      const data = await res.json();

      if (data?.success) {
        toast.success('Punch out recorded successfully!');

        /*
         * Immediately update UI.
         */
        setAttendance(data.data);

        /*
         * Existing realtime event.
         */
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

        /*
         * Confirm latest database state.
         */
        await refreshAttendance();
      } else {
        toast.error(
          data?.error ||
            data?.message ||
            'Check-out failed'
        );
      }
    } catch (err: any) {
      console.error(err);

      toast.error(
        err?.message ||
          'Check-out failed'
      );
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
  const isCheckedIn = Boolean(
    attendance?.checkInTime
  );

  const isCheckedOut = Boolean(
    attendance?.checkOutTime
  );

  const getStatusBadge = () => {
    if (refreshingAttendance) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[10px] border border-slate-200 dark:border-slate-700">
          <Loader2 className="w-3 h-3 animate-spin" />
          Checking Attendance
        </span>
      );
    }

    if (isCheckedIn && isCheckedOut) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
          <CheckCircle2 className="w-3 h-3" />
          Shift Completed
        </span>
      );
    }

    if (isCheckedIn) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] animate-pulse">
          <Sparkles className="w-3 h-3" />
          Currently On Duty
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[10px] border border-slate-200 dark:border-slate-700">
        <Clock className="w-3 h-3" />
        Ready for Check-in
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors">

      {/* Left: Clock and Date */}

      <div className="flex items-center gap-3">

        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>

        <div>

          <div className="flex items-center gap-2">

            <span
              className="text-lg font-black text-slate-900 dark:text-white font-mono tracking-tight"
              suppressHydrationWarning
            >
              {mounted
                ? time
                : '--:--:--'}
            </span>

            {getStatusBadge()}

          </div>

          <p
            className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium"
            suppressHydrationWarning
          >
            {mounted
              ? new Date().toLocaleDateString(
                  'en-US',
                  {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }
                )
              : 'Today'}

            {' · '}

            Main Shift: 11:00 AM – 8:00 PM
            {' '}
            (15m Grace)

          </p>

        </div>

      </div>


      {/* Right side */}

      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">

        {/* Punch Information */}

        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs">

          <div>

            <span className="text-[10px] text-slate-400 uppercase font-bold">
              In:{' '}
            </span>

            <span
              className="font-mono font-bold text-emerald-600 dark:text-emerald-400"
              suppressHydrationWarning
            >
              {mounted
                ? formatTimestamp(
                    attendance?.checkInTime
                  )
                : '--:--'}
            </span>

          </div>


          <span className="text-slate-300 dark:text-slate-700">
            |
          </span>


          <div>

            <span className="text-[10px] text-slate-400 uppercase font-bold">
              Out:{' '}
            </span>

            <span
              className="font-mono font-bold text-amber-600 dark:text-amber-400"
              suppressHydrationWarning
            >
              {mounted
                ? formatTimestamp(
                    attendance?.checkOutTime
                  )
                : '--:--'}
            </span>

          </div>


          <span className="text-slate-300 dark:text-slate-700">
            |
          </span>


          <div>

            <span className="text-[10px] text-slate-400 uppercase font-bold">
              Duration:{' '}
            </span>

            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">

              {attendance?.totalHours
                ? `${attendance.totalHours} hrs`
                : '0.00 hrs'}

            </span>

          </div>

        </div>


        {/* Buttons */}

        <div className="flex items-center gap-2">

          {/* CLOCK IN */}

          <button
            disabled={
              isCheckedIn ||
              loading ||
              refreshingAttendance
            }
            onClick={handleCheckIn}
            className="py-1.5 px-3.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >

            {loading && !isCheckedIn ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}

            <span>

              {isCheckedIn
                ? 'Punched In'
                : 'Clock In'}

            </span>

          </button>


          {/* CLOCK OUT */}

          <button
            disabled={
              !isCheckedIn ||
              isCheckedOut ||
              loading ||
              refreshingAttendance
            }
            onClick={handleCheckOut}
            className="py-1.5 px-3.5 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >

            {loading &&
            isCheckedIn &&
            !isCheckedOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}

            <span>

              {isCheckedOut
                ? 'Completed'
                : 'Clock Out'}

            </span>

          </button>

        </div>

      </div>

    </div>
  );
}