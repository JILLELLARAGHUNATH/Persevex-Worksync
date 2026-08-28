'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowUpDown,
  History,
  Sparkles,
  Check,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate, formatTime, getIndiaDateKey, formatDurationHMSFormatted } from '@/lib/utils';


import { toast } from 'sonner';

const EMPTY_ARRAY: any[] = [];

interface Props {
  todayAttendance: any;
  allRecords?: any[];
  employeeName?: string;
  employeeId?: string;
}

export default function MyAttendanceClient({
  todayAttendance,
  allRecords = EMPTY_ARRAY,
}: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [todayAtt, setTodayAtt] = useState(todayAttendance);
  const [records, setRecords] = useState(allRecords);
  const [search, setSearch] = useState('');
  
  // TODAY IS 1ST DEFAULT ACTIVE FILTER
  const [datePreset, setDatePreset] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL'>('TODAY');
  const [sortAsc, setSortAsc] = useState(false);
  const [time, setTime] = useState('');
  const [nowTick, setNowTick] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTodayAtt(todayAttendance);
    setRecords(allRecords);
  }, [todayAttendance, allRecords]);

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

  const currentUserId = todayAttendance?.userId || allRecords[0]?.userId;

  // Real-time synchronization (strictly isolated to current user)
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.type === 'ATTENDANCE_UPDATE') {
        const att = custom.detail.payload?.attendance;
        if (!att) return;

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

  // Calculate live current shift duration for today (HH:MM:SS)
  const todayLiveDuration = useMemo(() => {
    if (!todayAtt?.checkInTime) return '00h 00m 00s';
    if (todayAtt?.checkOutTime) {
      return formatDurationHMSFormatted(todayAtt.checkInTime, todayAtt.checkOutTime);
    }
    return formatDurationHMSFormatted(todayAtt.checkInTime, null, nowTick);
  }, [todayAtt, nowTick]);


  const todayKey = getIndiaDateKey(nowTick);
  const yesterdayKey = getIndiaDateKey(new Date(nowTick.getFullYear(), nowTick.getMonth(), nowTick.getDate() - 1));
  const startOfWeek = new Date(nowTick.getFullYear(), nowTick.getMonth(), nowTick.getDate() - 6);
  const startOfMonth = new Date(nowTick.getFullYear(), nowTick.getMonth(), 1);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const rKey = getIndiaDateKey(r.date);
      const rDate = new Date(r.date);


      if (datePreset === 'TODAY' && rKey !== todayKey) return false;
      if (datePreset === 'YESTERDAY' && rKey !== yesterdayKey) return false;
      if (datePreset === 'THIS_WEEK' && rDate < startOfWeek) return false;
      if (datePreset === 'THIS_MONTH' && rDate < startOfMonth) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const dateStr = formatDate(r.date).toLowerCase();
        const status = (r.status || '').toLowerCase();
        const late = (r.lateStatus || '').toLowerCase();
        if (!dateStr.includes(q) && !status.includes(q) && !late.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const aT = new Date(a.date).getTime();
      const bT = new Date(b.date).getTime();
      return sortAsc ? aT - bT : bT - aT;
    });
  }, [records, datePreset, search, sortAsc, todayKey, yesterdayKey, startOfWeek, startOfMonth]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {showHistory ? 'My Attendance History' : "Today's Attendance"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {showHistory
              ? 'Personal shift history ledger, working hours, and punctuality compliance'
              : 'Live shift clock-in, punch times, and daily status'}
          </p>
        </div>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-xs cursor-pointer"
        >
          {showHistory ? (
            <>
              <Clock className="w-3.5 h-3.5" />
              <span>View Today&apos;s Punch</span>
            </>
          ) : (
            <>
              <History className="w-3.5 h-3.5" />
              <span>Attendance History ({records.length})</span>
            </>
          )}
        </button>
      </div>

      {!showHistory ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 font-mono" suppressHydrationWarning>
                      {mounted ? time : '--:--:--'}
                    </span>
                    {isCheckedIn && isCheckedOut ? (
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-semibold text-xs">
                        <Check className="w-3.5 h-3.5 inline mr-1" /> Shift Completed
                      </span>
                    ) : isCheckedIn ? (
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 font-semibold text-xs">
                        ● On Duty
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold text-xs">
                        Ready to Punch In
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Shift: 11:00 AM – 8:00 PM (15m Grace) &middot; Target: 9.00 hrs
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today&apos;s Punch In</span>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5" suppressHydrationWarning>
                  {mounted && todayAtt?.checkInTime ? formatTime(todayAtt.checkInTime) : '--:--'}
                </p>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  {todayAtt?.lateStatus === 'LATE' ? '⚠️ Late Arrival (After 11:15 AM)' : todayAtt?.checkInTime ? '✓ On-Time Arrival' : 'Awaiting punch-in'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today&apos;s Punch Out</span>
                <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5" suppressHydrationWarning>
                  {mounted && todayAtt?.checkOutTime ? formatTime(todayAtt.checkOutTime) : '--:--'}
                </p>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  {todayAtt?.checkOutTime ? '✓ Shift completed' : 'Awaiting punch-out'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today&apos;s Duration</span>
                <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono mt-0.5" suppressHydrationWarning>
                  {mounted ? todayLiveDuration : '00h 00m 00s'}
                </p>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  Standard: 9.00 hrs shift
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                disabled={isCheckedIn || loading}
                onClick={handleCheckIn}
                className="py-3 px-5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading && !isCheckedIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isCheckedIn ? '✓ Punched In for Today' : 'Clock In Now'}</span>
              </button>

              <button
                disabled={!isCheckedIn || isCheckedOut || loading}
                onClick={handleCheckOut}
                className="py-3 px-5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading && isCheckedIn && !isCheckedOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                <span>{isCheckedOut ? '✓ Shift Completed' : 'Clock Out'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* NO TOP CARDS HERE - TODAY FILTER ACTIVE BY DEFAULT */
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by date, status, punctuality..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <button
                onClick={() => setDatePreset('TODAY')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'TODAY' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Today
              </button>
              <button
                onClick={() => setDatePreset('YESTERDAY')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'YESTERDAY' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setDatePreset('THIS_WEEK')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'THIS_WEEK' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                This Week
              </button>
              <button
                onClick={() => setDatePreset('THIS_MONTH')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'THIS_MONTH' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                This Month
              </button>
              <button
                onClick={() => setDatePreset('ALL')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                All Records
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-950/80 uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th onClick={() => setSortAsc(!sortAsc)} className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition">
                    <div className="flex items-center gap-1.5">
                      Date <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="p-4">Check In</th>
                  <th className="p-4">Check Out</th>
                  <th className="p-4">Working Duration</th>
                  <th className="p-4">Punctuality</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                      No attendance records found for this filter selection.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-medium text-slate-900 dark:text-slate-200">
                        {formatDate(r.date)}
                      </td>
                      <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatTime(r.checkInTime)}
                      </td>
                      <td className="p-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                        {formatTime(r.checkOutTime)}
                      </td>
                      <td className="p-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {r.checkInTime ? formatDurationHMSFormatted(r.checkInTime, r.checkOutTime, r.totalHours) : '—'}
                      </td>

                      <td className="p-4">
                        <StatusBadge status={r.lateStatus} />
                      </td>
                      <td className="p-4">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}