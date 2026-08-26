'use client';

import React, { useState, useMemo, useEffect } from 'react';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate, formatTime } from '@/lib/utils';
import {
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Download,
  FileSpreadsheet,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { exportAttendanceReport } from '@/actions/exportActions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function UnifiedAttendanceTable({
  initialRecords,
  teams = [],
  employees = [],
  showTeamCol = true,
}: {
  initialRecords: any[];
  teams?: any[];
  employees?: any[];
  showTeamCol?: boolean;
}) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('TODAY');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [checkInStatus, setCheckInStatus] = useState('');
  const [checkOutStatus, setCheckOutStatus] = useState('');
  const [punctualityFilter, setPunctualityFilter] = useState('');
  const [workingHoursFilter, setWorkingHoursFilter] = useState('');

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState('checkInTime');
  const [sortAsc, setSortAsc] = useState(false);

  const getLocalDateKey = (d: any): string => {
    if (!d) return '';
    const date = new Date(d);
    return (
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0')
    );
  };

  const now = new Date();

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  // Real-time synchronization
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail?.type === 'ATTENDANCE_UPDATE') {
          const att = detail.payload?.attendance;
          if (att) {
            setRecords((prev) => {
              const idx = prev.findIndex(
                (r) =>
                  r.id === att.id ||
                  (r.userId === att.userId && getLocalDateKey(r.date) === getLocalDateKey(att.date))
              );

              // Preserve or hydrate user object if missing
              let userObj = att.user;
              if (!userObj && idx >= 0 && prev[idx].user) {
                userObj = prev[idx].user;
              } else if (!userObj) {
                const foundEmp = employees.find((emp) => emp.id === att.userId);
                if (foundEmp) userObj = foundEmp;
              }

              const fullAtt = { ...att, user: userObj || att.user };

              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...fullAtt };
                return copy;
              }
              return [fullAtt, ...prev];
            });

            // Smooth background refresh
            router.refresh();
          }
        }
      } catch { }
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [employees, router]);

  const todayStr = getLocalDateKey(now);
  const yesterdayStr = getLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const startOfLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
  const endOfLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const filtered = useMemo(() => {
    return records
      .filter((r) => {
        const recDate = new Date(r.date);
        const recDateKey = getLocalDateKey(r.date);

        if (datePreset === 'TODAY' && recDateKey !== todayStr) return false;
        if (datePreset === 'YESTERDAY' && recDateKey !== yesterdayStr) return false;
        if (datePreset === 'THIS_WEEK' && recDate < startOfWeek) return false;
        if (datePreset === 'LAST_WEEK' && (recDate < startOfLastWeek || recDate > endOfLastWeek)) return false;
        if (datePreset === 'THIS_MONTH' && recDate < startOfMonth) return false;
        if (datePreset === 'LAST_MONTH' && (recDate < startOfLastMonth || recDate > endOfLastMonth)) return false;
        if (datePreset === 'CUSTOM') {
          if (customStart && recDateKey < customStart) return false;
          if (customEnd && recDateKey > customEnd) return false;
        }

        if (search.trim()) {
          const q = search.toLowerCase();
          const name = r.user?.fullName?.toLowerCase() || '';
          const id = r.user?.employeeId?.toLowerCase() || '';
          const email = r.user?.email?.toLowerCase() || '';
          if (!name.includes(q) && !id.includes(q) && !email.includes(q)) return false;
        }

        if (teamFilter && r.user?.teamId !== teamFilter) return false;
        if (employeeFilter && r.userId !== employeeFilter) return false;
        if (roleFilter && r.user?.role !== roleFilter) return false;

        if (statusFilter) {
          if (statusFilter === 'PRESENT') {
            if (r.status !== 'PRESENT') return false;
          } else if (statusFilter === 'LATE') {
            if (r.status !== 'PRESENT' || r.lateStatus !== 'LATE') return false;
          } else if (statusFilter === 'ON_TIME') {
            if (r.status !== 'PRESENT' || r.lateStatus !== 'ON_TIME') return false;
          } else {
            if (r.status !== statusFilter) return false;
          }
        }
        if (punctualityFilter && r.lateStatus !== punctualityFilter) return false;

        if (checkInStatus === 'CHECKED_IN' && !r.checkInTime) return false;
        if (checkInStatus === 'NOT_CHECKED_IN' && r.checkInTime) return false;
        if (checkOutStatus === 'CHECKED_OUT' && !r.checkOutTime) return false;
        if (checkOutStatus === 'NOT_CHECKED_OUT' && r.checkOutTime) return false;

        if (workingHoursFilter === 'UNDER_4' && r.totalHours >= 4) return false;
        if (workingHoursFilter === '4_TO_8' && (r.totalHours < 4 || r.totalHours > 8)) return false;
        if (workingHoursFilter === 'OVER_8' && r.totalHours <= 8) return false;

        return true;
      })
      .sort((a, b) => {
        // When sorting by checkInTime, prioritize newest check-in timestamps first
        if (sortField === 'checkInTime') {
          const aTime = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
          const bTime = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
          if (aTime !== bTime) {
            return sortAsc ? aTime - bTime : bTime - aTime;
          }
        }

        // Fallback or date sort
        const aDate = new Date(a.checkInTime || a.date).getTime();
        const bDate = new Date(b.checkInTime || b.date).getTime();
        return sortAsc ? aDate - bDate : bDate - aDate;
      });
  }, [
    records,
    search,
    datePreset,
    customStart,
    customEnd,
    teamFilter,
    employeeFilter,
    roleFilter,
    statusFilter,
    punctualityFilter,
    checkInStatus,
    checkOutStatus,
    workingHoursFilter,
    sortField,
    sortAsc,
    todayStr,
    yesterdayStr,
    startOfWeek,
    startOfLastWeek,
    endOfLastWeek,
    startOfMonth,
    startOfLastMonth,
    endOfLastMonth,
  ]);

  // Find latest active check-in
  const latestCheckIn = useMemo(() => {
    const todayActive = records.filter(
      (r) => getLocalDateKey(r.date) === todayStr && r.checkInTime
    );
    if (todayActive.length === 0) return null;
    return todayActive.sort(
      (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
    )[0];
  }, [records, todayStr]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      toast.info(`Generating ${format.toUpperCase()} attendance export...`);
      const res = await exportAttendanceReport({ format });
      if (res?.base64) {
        const link = document.createElement('a');
        link.href = `data:application/octet-stream;base64,${res.base64}`;
        link.download = res.fileName;
        link.click();
        toast.success('Download complete!');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export attendance');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setDatePreset('TODAY');
    setCustomStart('');
    setCustomEnd('');
    setTeamFilter('');
    setEmployeeFilter('');
    setRoleFilter('');
    setStatusFilter('');
    setCheckInStatus('');
    setCheckOutStatus('');
    setPunctualityFilter('');
    setWorkingHoursFilter('');
    setSortField('checkInTime');
    setSortAsc(false);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Latest Check-in Live Activity Banner */}
      {latestCheckIn && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-transparent border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <span className="font-bold text-slate-900 dark:text-white">Latest Check-In: </span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                {latestCheckIn.user?.fullName || 'Staff Member'}
              </span>
              <span className="text-slate-500 dark:text-slate-400 ml-1.5 font-mono">
                at {latestCheckIn.checkInTime ? formatTime(latestCheckIn.checkInTime) : '--:--'}
              </span>
              {latestCheckIn.lateStatus === 'LATE' ? (
                <span className="ml-2 text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded font-bold">
                  Late
                </span>
              ) : (
                <span className="ml-2 text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                  On-Time
                </span>
              )}
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Live Check-In Feed
          </span>
        </div>
      )}

      {/* Filter Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm space-y-3 transition-colors">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Employee Name, ID, or Email..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-bold focus:outline-none cursor-pointer"
            >
              <option value="TODAY">Today (Default)</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="LAST_WEEK">Last Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="CUSTOM">Custom Range</option>
            </select>

            {showTeamCol && teams.length > 0 && (
              <select
                value={teamFilter}
                onChange={(e) => {
                  setTeamFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
              >
                <option value="">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Filters {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => handleExport('csv')}
              className="px-3.5 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center gap-1.5 hover:bg-indigo-100 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>

            <button
              onClick={resetFilters}
              className="p-2 text-slate-400 hover:text-rose-500 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-500">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 font-mono text-xs"
            />
            <span className="font-semibold text-slate-500">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 font-mono text-xs"
            />
          </div>
        )}

        {/* Advanced Filters Panel */}
        {advancedOpen && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="HALF_DAY">Half Day</option>
            </select>

            <select
              value={punctualityFilter}
              onChange={(e) => setPunctualityFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2"
            >
              <option value="">Punctuality</option>
              <option value="ON_TIME">On Time (&le; 11:15 AM)</option>
              <option value="LATE">Late (&gt; 11:15 AM)</option>
            </select>

            <select
              value={checkInStatus}
              onChange={(e) => setCheckInStatus(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2"
            >
              <option value="">Check-In State</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="NOT_CHECKED_IN">Not Checked In</option>
            </select>

            <select
              value={workingHoursFilter}
              onChange={(e) => setWorkingHoursFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2"
            >
              <option value="">Hours Filter</option>
              <option value="UNDER_4">&lt; 4.0 hrs</option>
              <option value="4_TO_8">4.0 - 8.0 hrs</option>
              <option value="OVER_8">&gt; 8.0 hrs</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Date</th>
                <th className="p-4">
                  <button
                    onClick={() => {
                      if (sortField === 'checkInTime') setSortAsc(!sortAsc);
                      else {
                        setSortField('checkInTime');
                        setSortAsc(false);
                      }
                    }}
                    className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition cursor-pointer"
                  >
                    Check In {sortField === 'checkInTime' && (sortAsc ? '▲' : '▼ (Latest)')}
                  </button>
                </th>
                <th className="p-4">Check Out</th>
                <th className="p-4">Working Hours</th>
                <th className="p-4">Punctuality</th>
                <th className="p-4">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No attendance records found for this view.
                  </td>
                </tr>
              ) : (
                paginated.map((r, i) => (
                  <tr key={r.id || `${r.userId}_${r.date}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {r.user?.fullName || 'Employee'}
                        {i === 0 && r.checkInTime && getLocalDateKey(r.date) === todayStr && (
                          <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.2 rounded font-bold">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.user?.employeeId || 'ID: --'} {showTeamCol && r.user?.team?.name ? `· ${r.user.team.name}` : ''}
                      </div>
                    </td>
                    <td className="p-4 font-mono">
                      {formatDate(r.date)}
                    </td>
                    <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {r.checkInTime ? formatTime(r.checkInTime) : '—'}
                    </td>
                    <td className="p-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {r.checkOutTime ? formatTime(r.checkOutTime) : '—'}
                    </td>
                    <td className="p-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {r.totalHours ? `${r.totalHours} hrs` : r.checkInTime ? 'In Progress' : '—'}
                    </td>
                    <td className="p-4">
                      {r.lateStatus === 'LATE' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" /> Late Arrival
                        </span>
                      ) : r.checkInTime ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> On Time
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={r.status || 'PRESENT'} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{paginated.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{filtered.length}</strong> entries
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 font-bold"
            >
              Previous
            </button>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 font-bold"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
