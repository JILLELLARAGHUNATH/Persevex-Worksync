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
import { formatDate, formatTime } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  todayAttendance: any;
  allRecords: any[];
  employeeName: string;
  employeeId: string;
}

export default function MyAttendanceClient({
  todayAttendance,
  allRecords = [],
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

  // Real-time synchronization
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.type === 'ATTENDANCE_UPDATE') {
        const att = custom.detail.payload?.attendance;
        if (att) {
          setTodayAtt(att);
          setRecords((prev) => {
            const idx = prev.findIndex((r) => r.id === att.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = att;
              return copy;
            }
            return [att, ...prev];
          });
        }
      }
    };
    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, []);

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

  const todayLiveDuration = useMemo(() => {
    if (!todayAtt?.checkInTime) return '0.00';
    if (todayAtt?.checkOutTime && todayAtt?.totalHours) {
      return Number(todayAtt.totalHours).toFixed(2);
    }
    const checkInDate = new Date(todayAtt.checkInTime);
    const diffMs = nowTick.getTime() - checkInDate.getTime();
    const hours = Math.max(0, diffMs) / (1000 * 60 * 60);
    return hours.toFixed(2);
  }, [todayAtt, nowTick]);

  const getLocalDateKey = (d: Date | string) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const todayKey = getLocalDateKey(nowTick);
  const yesterdayKey = getLocalDateKey(new Date(nowTick.getFullYear(), nowTick.getMonth(), nowTick.getDate() - 1));
  const startOfWeek = new Date(nowTick.getFullYear(), nowTick.getMonth(), nowTick.getDate() - 6);
  const startOfMonth = new Date(nowTick.getFullYear(), nowTick.getMonth(), 1);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const rKey = getLocalDateKey(r.date);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          {showHistory ? (
            <>
              <Clock className="w-4 h-4" />
              <span>View Today's Punch</span>
            </>
          ) : (
            <>
              <History className="w-4 h-4" />
              <span>Attendance History ({records.length})</span>
            </>
          )}
        </button>
      </div>

      {!showHistory ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Clock className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono" suppressHydrationWarning>
                      {mounted ? time : '--:--:--'}
                    </span>
                    {isCheckedIn && isCheckedOut ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        <Check className="w-3.5 h-3.5 inline mr-1" /> Shift Completed
                      </span>
                    ) : isCheckedIn ? (
                      <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs animate-pulse">
                        ● On Duty
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs">
                        Ready to Punch In
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Shift: 11:00 AM – 8:00 PM (15m Grace) &middot; Target: 9.00 hrs
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Today's Punch In</span>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1" suppressHydrationWarning>
                  {mounted && todayAtt?.checkInTime ? formatTime(todayAtt.checkInTime) : '--:--'}
                </p>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  {todayAtt?.lateStatus === 'LATE' ? '⚠️ Late Arrival (After 11:15 AM)' : todayAtt?.checkInTime ? '✓ On-Time Arrival' : 'Awaiting punch-in'}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Today's Punch Out</span>
                <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1" suppressHydrationWarning>
                  {mounted && todayAtt?.checkOutTime ? formatTime(todayAtt.checkOutTime) : '--:--'}
                </p>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  {todayAtt?.checkOutTime ? '✓ Shift completed' : 'Awaiting punch-out'}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Today's Duration</span>
                <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                  {todayLiveDuration} hrs
                </p>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  Standard: 9.00 hrs shift
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                disabled={isCheckedIn || loading}
                onClick={handleCheckIn}
                className="py-4 px-6 rounded-2xl font-black text-sm text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {loading && !isCheckedIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>{isCheckedIn ? '✓ Punched In for Today' : 'Clock In Now'}</span>
              </button>

              <button
                disabled={!isCheckedIn || isCheckedOut || loading}
                onClick={handleCheckOut}
                className="py-4 px-6 rounded-2xl font-black text-sm text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-md shadow-amber-600/20 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {loading && isCheckedIn && !isCheckedOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertCircle className="w-5 h-5" />}
                <span>{isCheckedOut ? '✓ Shift Completed' : 'Clock Out'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* NO TOP CARDS HERE - TODAY FILTER ACTIVE BY DEFAULT */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by date, status, punctuality..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <button
                onClick={() => setDatePreset('TODAY')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'TODAY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Today
              </button>
              <button
                onClick={() => setDatePreset('YESTERDAY')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'YESTERDAY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setDatePreset('THIS_WEEK')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'THIS_WEEK' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                This Week
              </button>
              <button
                onClick={() => setDatePreset('THIS_MONTH')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'THIS_MONTH' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                This Month
              </button>
              <button
                onClick={() => setDatePreset('ALL')}
                className={`px-3 py-1.5 rounded-xl transition ${datePreset === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
              >
                All Records
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
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
                        {r.totalHours ? `${r.totalHours} hrs` : '0 hrs'}
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