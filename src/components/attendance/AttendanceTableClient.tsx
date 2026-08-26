'use client';

import { useState, useMemo, useEffect } from 'react';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate, formatTime } from '@/lib/utils';
import {
  Search,
  Clock,
  ArrowUpDown
} from 'lucide-react';

function getLocalDateKey(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

interface AttendanceTableProps {
  initialRecords: any[];
  departments?: any[];
  teams?: any[];
  showEmployeeCol?: boolean;
  showDeptCol?: boolean;
  title: string;
  subtitle: string;
}

export default function AttendanceTableClient({
  initialRecords,
  departments = [],
  teams = [],
  showEmployeeCol = true,
  showDeptCol = true,
  title,
  subtitle,
}: AttendanceTableProps) {
  // Today is 1st and selected by default
  const [datePreset, setDatePreset] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL' | 'CUSTOM'>('TODAY');
  const [customDate, setCustomDate] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lateFilter, setLateFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [records, setRecords] = useState<any[]>(initialRecords || []);

  useEffect(() => {
    setRecords(initialRecords || []);
  }, [initialRecords]);

  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const custom = e as CustomEvent;
        const data = custom.detail;
        if (!data || data.type !== 'ATTENDANCE_UPDATE') return;
        const att = data.payload?.attendance;
        if (!att) return;

        setRecords((prev) => {
          const idx = prev.findIndex((x) => x.id === att.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = att;
            return copy;
          }
          return [att, ...prev];
        });
      } catch (err) {
        console.error('Attendance realtime handler error', err);
      }
    };

    window.addEventListener('persevex-realtime', handler as EventListener);
    return () => window.removeEventListener('persevex-realtime', handler as EventListener);
  }, []);

  const now = new Date();
  const localTodayKey = getLocalDateKey(now);
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const localYesterdayKey = getLocalDateKey(yesterdayDate);
  const startOfWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
  const startOfMonthDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfTodayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const recordDateObj = new Date(r.checkInTime || r.date);
      const recordDateKey = getLocalDateKey(r.checkInTime || r.date);

      if (datePreset === 'TODAY' && recordDateKey !== localTodayKey) return false;
      if (datePreset === 'YESTERDAY' && recordDateKey !== localYesterdayKey) return false;
      if (datePreset === 'THIS_WEEK' && (recordDateObj < startOfWeekDate || recordDateObj > endOfTodayDate)) return false;
      if (datePreset === 'THIS_MONTH' && (recordDateObj < startOfMonthDate || recordDateObj > endOfTodayDate)) return false;
      if (datePreset === 'CUSTOM' && customDate && recordDateKey !== customDate) return false;

      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const empName = r.user?.fullName?.toLowerCase() || '';
        const empId = r.user?.employeeId?.toLowerCase() || '';
        const empEmail = r.user?.email?.toLowerCase() || '';
        const deptName = r.user?.department?.name?.toLowerCase() || '';
        const teamName = r.user?.team?.name?.toLowerCase() || '';

        if (
          !empName.includes(query) &&
          !empId.includes(query) &&
          !empEmail.includes(query) &&
          !deptName.includes(query) &&
          !teamName.includes(query)
        ) {
          return false;
        }
      }

      if (lateFilter && r.lateStatus !== lateFilter) return false;
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
      if (deptFilter && r.user?.departmentId !== deptFilter && r.user?.department?.id !== deptFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const aTime = new Date(a.checkInTime || a.date).getTime();
        const bTime = new Date(b.checkInTime || b.date).getTime();
        return sortAsc ? aTime - bTime : bTime - aTime;
      }
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      if (typeof aVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
  }, [
    records,
    datePreset,
    customDate,
    search,
    statusFilter,
    lateFilter,
    deptFilter,
    sortField,
    sortAsc,
    localTodayKey,
    localYesterdayKey,
    startOfWeekDate,
    startOfMonthDate,
    endOfTodayDate,
  ]);

  const totalCount = filteredRecords.length;
  const onTimeCount = filteredRecords.filter((r) => r.lateStatus === 'ON_TIME' && r.checkInTime).length;
  const lateCount = filteredRecords.filter((r) => r.lateStatus === 'LATE').length;
  const totalHours = filteredRecords.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
  const avgHours = totalCount > 0 ? (totalHours / totalCount).toFixed(1) : '0.0';

  const isAnyFilterActive =
    datePreset !== 'TODAY' ||
    customDate !== '' ||
    search !== '' ||
    statusFilter !== '' ||
    lateFilter !== '' ||
    deptFilter !== '';

  const handleResetFilters = () => {
    setDatePreset('TODAY');
    setCustomDate('');
    setSearch('');
    setStatusFilter('');
    setLateFilter('');
    setDeptFilter('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-mono font-bold">
          <Clock className="w-3.5 h-3.5" /> Shift: 11:00 AM – 8:00 PM (Wed Off)
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm dark:shadow-xl transition-colors">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filtered Logs</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm dark:shadow-xl transition-colors">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">On-Time (By 11:15 AM)</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{onTimeCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm dark:shadow-xl transition-colors">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Late Arrivals</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{lateCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm dark:shadow-xl transition-colors">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Shift Hours</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{avgHours} hrs</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Standard Filter Order: Today 1st -> Yesterday -> This Week -> This Month -> All Time */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <button onClick={() => { setDatePreset('TODAY'); setCustomDate(''); }} className={'px-3 py-1.5 rounded-xl font-bold transition ' + (datePreset === 'TODAY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}>Today</button>
            <button onClick={() => { setDatePreset('YESTERDAY'); setCustomDate(''); }} className={'px-3 py-1.5 rounded-xl font-bold transition ' + (datePreset === 'YESTERDAY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}>Yesterday</button>
            <button onClick={() => { setDatePreset('THIS_WEEK'); setCustomDate(''); }} className={'px-3 py-1.5 rounded-xl font-bold transition ' + (datePreset === 'THIS_WEEK' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}>This Week</button>
            <button onClick={() => { setDatePreset('THIS_MONTH'); setCustomDate(''); }} className={'px-3 py-1.5 rounded-xl font-bold transition ' + (datePreset === 'THIS_MONTH' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}>This Month</button>
            <button onClick={() => { setDatePreset('ALL'); setCustomDate(''); }} className={'px-3 py-1.5 rounded-xl font-bold transition ' + (datePreset === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}>All Time</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold hidden sm:inline">Pick Date:</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                if (e.target.value) setDatePreset('CUSTOM');
                else setDatePreset('TODAY');
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          {showEmployeeCol && (
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID, or email..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <select
              value={lateFilter}
              onChange={(e) => setLateFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="">All Punctuality</option>
              <option value="ON_TIME">On Time (By 11:15 AM)</option>
              <option value="LATE">Late (After 11:15 AM)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="ABSENT">Absent</option>
            </select>

            {showDeptCol && departments.length > 0 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}

            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-red-600 dark:text-red-400 font-bold hover:underline px-2"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-950/80 uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th onClick={() => { setSortField('date'); setSortAsc(!sortAsc); }} className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition">
                <div className="flex items-center gap-1.5">
                  Date <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              {showEmployeeCol && <th className="p-4">Employee</th>}
              {showDeptCol && <th className="p-4">Department & Squad</th>}
              <th className="p-4">Punch In (11:00 AM)</th>
              <th className="p-4">Punch Out (8:00 PM)</th>
              <th className="p-4">Logged Hours</th>
              <th className="p-4">Punctuality</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  No attendance records found matching this date or filter selection.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="p-4 font-mono font-medium text-slate-900 dark:text-slate-200">
                    {formatDate(r.date)}
                  </td>
                  {showEmployeeCol && (
                    <td className="p-4">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{r.user?.fullName || 'Personnel'}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{r.user?.employeeId || ''}</p>
                    </td>
                  )}
                  {showDeptCol && (
                    <td className="p-4">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{r.user?.department?.name || 'Unassigned'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{r.user?.team?.name || 'No Squad'}</p>
                    </td>
                  )}
                  <td className="p-4 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    {formatTime(r.checkInTime)}
                  </td>
                  <td className="p-4 text-amber-600 dark:text-amber-400 font-mono font-bold">
                    {formatTime(r.checkOutTime)}
                  </td>
                  <td className="p-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {r.totalHours} hrs
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
  );
}