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

import { getIndiaDateKey, formatDurationHMSFormatted } from '@/lib/utils';

const EMPTY_ARRAY: any[] = [];

export default function UnifiedAttendanceTable({
  initialRecords = EMPTY_ARRAY,
  teams = EMPTY_ARRAY,
  employees = EMPTY_ARRAY,
  approvedLeaves = EMPTY_ARRAY,
  showTeamCol = true,
  currentUserId,
  defaultStatus,
}: {
  initialRecords?: any[];
  teams?: any[];
  employees?: any[];
  approvedLeaves?: any[];
  showTeamCol?: boolean;
  currentUserId?: string;
  defaultStatus?: string;
}) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [employeeList, setEmployeeList] = useState(employees);
  const [leavesList, setLeavesList] = useState(approvedLeaves);

  const initialStatusValue = defaultStatus !== undefined ? defaultStatus : (showTeamCol ? 'PRESENT' : '');

  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('TODAY');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusValue);
  const [checkInStatus, setCheckInStatus] = useState('');
  const [checkOutStatus, setCheckOutStatus] = useState('');
  const [punctualityFilter, setPunctualityFilter] = useState('');
  const [workingHoursFilter, setWorkingHoursFilter] = useState('');

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState('checkInTime');
  const [sortAsc, setSortAsc] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [nowTick, setNowTick] = useState<Date>(new Date());
  const now = nowTick;

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  useEffect(() => {
    setEmployeeList(employees);
  }, [employees]);

  useEffect(() => {
    setLeavesList(approvedLeaves);
  }, [approvedLeaves]);

  const todayStr = getIndiaDateKey(now);

  // Real-time synchronization
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;

        if (detail.type === 'ATTENDANCE_UPDATE') {
          const att = detail.payload?.attendance;
          const status = detail.payload?.status;
          const userId = detail.payload?.userId || att?.userId;
          const attId = detail.payload?.attendanceId || att?.id;

          // For personal view (My Attendance), strictly filter out records for other users
          if (!showTeamCol) {
            const targetUserId = currentUserId || (records && records[0]?.userId);
            if (!targetUserId || userId !== targetUserId) {
              return;
            }
          }

          if (status === 'ATTENDANCE_DELETED' || (!att && userId)) {
            setRecords((prev) =>
              prev.filter(
                (r) =>
                  r.id !== attId &&
                  !(r.userId === userId && getIndiaDateKey(r.date) === todayStr)
              )
            );
            return;
          }

          if (att) {
            setRecords((prev) => {
              const idx = prev.findIndex(
                (r) =>
                  r.id === att.id ||
                  (r.userId === att.userId && getIndiaDateKey(r.date) === getIndiaDateKey(att.date))
              );

              // Preserve or hydrate user object if missing
              let userObj = att.user;
              if (!userObj && idx >= 0 && prev[idx].user) {
                userObj = prev[idx].user;
              } else if (!userObj) {
                const foundEmp = employeeList.find((emp) => emp.id === att.userId);
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
          }
        } else if (detail.type === 'WORKFORCE_UPDATE') {
          const user = detail.payload?.user;
          const action = detail.payload?.action;

          if (action === 'EMPLOYEE_CREATED' && user) {
            setEmployeeList((prev) => {
              if (prev.some((x) => x.id === user.id)) return prev;
              return [user, ...prev];
            });
          } else if (action === 'EMPLOYEE_UPDATED' && user) {
            setEmployeeList((prev) => prev.map((x) => (x.id === user.id ? { ...x, ...user } : x)));
          } else if (action === 'EMPLOYEE_DELETED' && detail.payload?.userId) {
            setEmployeeList((prev) => prev.filter((x) => x.id !== detail.payload.userId));
          } else if (action === 'STATUS_TOGGLED' && user) {
            setEmployeeList((prev) =>
              prev.map((x) => (x.id === user.id ? { ...x, accountStatus: user.accountStatus } : x))
            );
          }
        } else if (detail.type === 'LEAVE_STATUS_CHANGED') {
          const leave = detail.payload?.leave;
          const stage = detail.payload?.stage || leave?.currentStage;
          const leaveId = detail.payload?.leaveId || leave?.id;
          const type = detail.payload?.type;

          if (type === 'LEAVE_DELETED' || stage === 'DELETED') {
            if (leaveId) {
              setLeavesList((prev) => prev.filter((l) => l.id !== leaveId));
            }
          } else if (stage === 'APPROVED' && leave) {
            setLeavesList((prev) => {
              const filtered = prev.filter((l) => l.id !== leaveId);
              return [leave, ...filtered];
            });
          } else if (stage !== 'APPROVED' && leaveId) {
            setLeavesList((prev) => prev.filter((l) => l.id !== leaveId));
          }
        } else if (detail.type === 'SNAPSHOT_SYNC' && detail.snapshot?.todayAttendanceMap) {
          const todayMap = detail.snapshot.todayAttendanceMap;
          setRecords((prev) => {
            const otherDays = prev.filter((r) => getIndiaDateKey(r.date) !== todayStr);
            const todayRecords = prev.filter((r) => getIndiaDateKey(r.date) === todayStr);
            const updatedToday = todayRecords
              .filter((r) => Boolean(todayMap[r.userId]))
              .map((r) => {
                const snap = todayMap[r.userId];
                return snap ? { ...r, ...snap } : r;
              });

            Object.values(todayMap).forEach((snapAtt: any) => {
              if (!showTeamCol) {
                const targetUserId = currentUserId || (records && records[0]?.userId);
                if (targetUserId && snapAtt.userId !== targetUserId) return;
              }
              if (!updatedToday.some((r) => r.userId === snapAtt.userId)) {
                const user = employeeList.find((e) => e.id === snapAtt.userId);
                updatedToday.push({ ...snapAtt, user });
              }
            });

            return [...updatedToday, ...otherDays];
          });
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [employeeList, router, showTeamCol, currentUserId, todayStr]);

  const yesterdayStr = getIndiaDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const startOfLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
  const endOfLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Combine recorded attendance + logically generated absent/on-leave employees
  const combinedRecords = useMemo(() => {
    let activePool: any[] = [];
    if (showTeamCol) {
      activePool = employeeList.filter(
        (e) => !e.isDeleted && e.accountStatus !== 'SUSPENDED' && e.role !== 'MANAGER'
      );
    } else if (currentUserId) {
      activePool = employeeList.filter(
        (e) => e.id === currentUserId && !e.isDeleted && e.accountStatus !== 'SUSPENDED'
      );
    }

    const targetDates: string[] = [];
    if (datePreset === 'TODAY') {
      targetDates.push(todayStr);
    } else if (datePreset === 'YESTERDAY') {
      targetDates.push(yesterdayStr);
    } else if (datePreset === 'CUSTOM' && customStart && customEnd && customStart === customEnd) {
      targetDates.push(customStart);
    } else {
      targetDates.push(todayStr);
    }

    const logicalRows: any[] = [];

    targetDates.forEach((targetDateStr) => {
      const recordedOnDate = records.filter(
        (r) => getIndiaDateKey(r.date) === targetDateStr
      );
      const recordedUserIds = new Set(recordedOnDate.map((r) => r.userId));

      activePool.forEach((emp) => {
        if (!recordedUserIds.has(emp.id)) {
          const isOnApprovedLeave = leavesList.some((l) => {
            if (l.userId !== emp.id) return false;
            if (l.currentStage !== 'APPROVED') return false;
            const s = getIndiaDateKey(l.startDate);
            const e = getIndiaDateKey(l.endDate);
            return targetDateStr >= s && targetDateStr <= e;
          });

          logicalRows.push({
            id: `logical-${isOnApprovedLeave ? 'leave' : 'absent'}-${emp.id}-${targetDateStr}`,
            userId: emp.id,
            date: targetDateStr,
            checkInTime: null,
            checkOutTime: null,
            totalHours: 0,
            status: isOnApprovedLeave ? 'ON_LEAVE' : 'ABSENT',
            lateStatus: null,
            user: emp,
            isLogical: true,
            isOnApprovedLeave,
          });
        }
      });
    });

    return [...records, ...logicalRows];
  }, [
    records,
    employeeList,
    leavesList,
    showTeamCol,
    currentUserId,
    datePreset,
    customStart,
    customEnd,
    todayStr,
    yesterdayStr,
  ]);

  const filtered = useMemo(() => {
    return combinedRecords
      .filter((r) => {
        const recDate = new Date(r.date);
        const recDateKey = getIndiaDateKey(r.date);

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
          const empId = r.user?.employeeId?.toLowerCase() || '';
          const email = r.user?.email?.toLowerCase() || '';
          if (!name.includes(q) && !empId.includes(q) && !email.includes(q)) return false;
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
          } else if (statusFilter === 'ABSENT') {
            // Absent = no check-in record for selected date
            if (r.status !== 'ABSENT' && !r.isLogical && r.checkInTime) return false;
          } else if (statusFilter === 'ON_LEAVE') {
            if (r.status !== 'ON_LEAVE' && !r.isOnApprovedLeave) return false;
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
        // When sorting by checkInTime, prioritize newest check-in timestamps first, then place non-checked-in alphabetically by name
        if (sortField === 'checkInTime') {
          const aTime = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
          const bTime = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
          if (aTime !== bTime) {
            return sortAsc ? aTime - bTime : bTime - aTime;
          }
          const aName = a.user?.fullName || '';
          const bName = b.user?.fullName || '';
          return aName.localeCompare(bName);
        }

        // Fallback or date sort
        const aDate = new Date(a.checkInTime || a.date).getTime();
        const bDate = new Date(b.checkInTime || b.date).getTime();
        if (aDate !== bDate) {
          return sortAsc ? aDate - bDate : bDate - aDate;
        }
        const aName = a.user?.fullName || '';
        const bName = b.user?.fullName || '';
        return aName.localeCompare(bName);
      });
  }, [
    combinedRecords,
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
      (r) => getIndiaDateKey(r.date) === todayStr && r.checkInTime
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
      const res = await exportAttendanceReport({
        format,
        status: statusFilter || undefined,
        datePreset,
        customStart: customStart || undefined,
        customEnd: customEnd || undefined,
        teamId: teamFilter || undefined,
      });
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
    setStatusFilter(initialStatusValue);
    setCheckInStatus('');
    setCheckOutStatus('');
    setPunctualityFilter('');
    setWorkingHoursFilter('');
    setSortField('checkInTime');
    setSortAsc(false);
    setPage(1);
  };

  return (
    <div className="space-y-3.5">
      {/* Latest Check-in Live Activity Banner */}
      {latestCheckIn && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-lg p-3 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Latest Check-In: </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                {latestCheckIn.user?.fullName || 'Staff Member'}
              </span>
              <span className="text-slate-500 dark:text-slate-400 ml-1.5 font-mono">
                at {latestCheckIn.checkInTime ? formatTime(latestCheckIn.checkInTime) : '--:--'}
              </span>
              {latestCheckIn.lateStatus === 'LATE' ? (
                <span className="ml-2 text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 px-1.5 py-0.5 rounded font-medium">
                  Late
                </span>
              ) : (
                <span className="ml-2 text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded font-medium">
                  On-Time
                </span>
              )}
            </div>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
            Live Feed
          </span>
        </div>
      )}

      {/* Filter Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 rounded-xl shadow-xs space-y-2.5 transition-colors">
        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Employee Name, ID, or Email..."
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setPage(1);
              }}
              className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
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
                className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
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
              className="h-8 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Filters {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => handleExport('csv')}
              className="h-8 px-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>

            <button
              onClick={resetFilters}
              className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-rose-500 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-mono text-xs"
            />
            <span className="text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-mono text-xs"
            />
          </div>
        )}

        {/* Advanced Filters Panel */}
        {advancedOpen && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
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
              className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs"
            >
              <option value="">Punctuality</option>
              <option value="ON_TIME">On Time (&le; 11:15 AM)</option>
              <option value="LATE">Late (&gt; 11:15 AM)</option>
            </select>

            <select
              value={checkInStatus}
              onChange={(e) => setCheckInStatus(e.target.value)}
              className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs"
            >
              <option value="">Check-In State</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="NOT_CHECKED_IN">Not Checked In</option>
            </select>

            <select
              value={workingHoursFilter}
              onChange={(e) => setWorkingHoursFilter(e.target.value)}
              className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs"
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">
                  <button
                    onClick={() => {
                      if (sortField === 'checkInTime') setSortAsc(!sortAsc);
                      else {
                        setSortField('checkInTime');
                        setSortAsc(false);
                      }
                    }}
                    className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 transition cursor-pointer"
                  >
                    Check In {sortField === 'checkInTime' && (sortAsc ? '▲' : '▼')}
                  </button>
                </th>
                <th className="py-3 px-4">Check Out</th>
                <th className="py-3 px-4">Working Hours</th>
                <th className="py-3 px-4">Punctuality</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No attendance records found for this view.
                  </td>
                </tr>
              ) : (
                paginated.map((r, i) => (
                  <tr key={r.id || `${r.userId}_${r.date}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        {r.user?.fullName || 'Employee'}
                        {i === 0 && r.checkInTime && getIndiaDateKey(r.date) === todayStr && (
                          <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-1 py-0.5 rounded font-medium">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.user?.employeeId || 'ID: --'} {showTeamCol && r.user?.team?.name ? `· ${r.user.team.name}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {formatDate(r.date)}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      {r.checkInTime ? formatTime(r.checkInTime) : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-amber-600 dark:text-amber-400">
                      {r.checkOutTime ? formatTime(r.checkOutTime) : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-blue-600 dark:text-blue-400" suppressHydrationWarning>
                      {r.checkInTime
                        ? mounted
                          ? formatDurationHMSFormatted(r.checkInTime, r.checkOutTime, r.checkOutTime ? r.totalHours : nowTick)
                          : (r.checkOutTime ? formatDurationHMSFormatted(r.checkInTime, r.checkOutTime, r.totalHours) : 'In Progress')
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {r.lateStatus === 'LATE' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> Late Arrival
                        </span>
                      ) : r.checkInTime ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> On Time
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.status || 'PRESENT'} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{paginated.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{filtered.length}</strong> entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
            >
              Previous
            </button>
            <span className="font-medium text-slate-700 dark:text-slate-300 px-1">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
