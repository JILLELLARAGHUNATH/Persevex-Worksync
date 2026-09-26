'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  X,
  Loader2,
  CalendarDays,
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { MonthCalendarSummary, CalendarDayInfo } from '@/lib/calendar';
import {
  getWorkCalendarMonthAction,
  addCompanyHolidayAction,
  addSpecialWorkingDayAction,
  deleteCalendarEntryAction,
  updateCompanyHolidayAction,
  getManagerDateAttendanceDetailsAction,
  DateAttendanceEmployee,
} from '@/actions/calendarActions';
import { getTodayIndiaDateKey } from '@/lib/attendanceDate';

interface Props {
  initialCalendar: MonthCalendarSummary;
  initialYear: number;
  initialMonth: number;
  role: 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';
  currentUserId: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_HEADERS = [
  { short: 'Sun', full: 'Sunday' },
  { short: 'Mon', full: 'Monday' },
  { short: 'Tue', full: 'Tuesday' },
  { short: 'Wed', full: 'Wednesday (Weekly Off)' },
  { short: 'Thu', full: 'Thursday' },
  { short: 'Fri', full: 'Friday' },
  { short: 'Sat', full: 'Saturday' },
];

export default function WorkCalendarClient({
  initialCalendar,
  initialYear,
  initialMonth,
  role,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [calendar, setCalendar] = useState<MonthCalendarSummary>(initialCalendar);
  const [year, setYear] = useState<number>(initialYear);
  const [month, setMonth] = useState<number>(initialMonth);
  const [loading, setLoading] = useState<boolean>(false);

  // Modals state
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [specialDayModalOpen, setSpecialDayModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);

  // Form states
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formNotify, setFormNotify] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Hover & Popover states for compact leave indicators
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const [pinnedDateKey, setPinnedDateKey] = useState<string | null>(null);

  // Manager Date Attendance popover state
  const [activeAttendancePopover, setActiveAttendancePopover] = useState<{
    dateKey: string;
    type: 'PRESENT' | 'ABSENT';
    isPinned: boolean;
  } | null>(null);
  const [dateDetailsCache, setDateDetailsCache] = useState<Record<string, any>>({});
  const [loadingDateDetails, setLoadingDateDetails] = useState<boolean>(false);

  const todayKey = getTodayIndiaDateKey();
  const isManager = role === 'MANAGER';

  // Close pinned popovers when clicking elsewhere on the window
  useEffect(() => {
    const handleGlobalClick = () => {
      setPinnedDateKey(null);
      setActiveAttendancePopover(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const fetchDateDetailsIfNeeded = async (dateKey: string) => {
    if (!dateDetailsCache[dateKey]) {
      setLoadingDateDetails(true);
      try {
        const res = await getManagerDateAttendanceDetailsAction({ dateKey });
        if (res.success) {
          setDateDetailsCache((prev) => ({ ...prev, [dateKey]: res }));
        }
      } catch (err) {
        console.error('Failed to load date details:', err);
      } finally {
        setLoadingDateDetails(false);
      }
    }
  };

  const handleHoverAttendancePopover = (dateKey: string, type: 'PRESENT' | 'ABSENT') => {
    if (activeAttendancePopover?.isPinned) return;
    setActiveAttendancePopover({ dateKey, type, isPinned: false });
    fetchDateDetailsIfNeeded(dateKey);
  };

  const handleLeaveAttendancePopover = () => {
    if (activeAttendancePopover?.isPinned) return;
    setActiveAttendancePopover(null);
  };

  const handleToggleAttendancePopover = (dateKey: string, type: 'PRESENT' | 'ABSENT', e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      activeAttendancePopover?.dateKey === dateKey &&
      activeAttendancePopover?.type === type &&
      activeAttendancePopover?.isPinned
    ) {
      setActiveAttendancePopover(null);
    } else {
      setActiveAttendancePopover({ dateKey, type, isPinned: true });
      fetchDateDetailsIfNeeded(dateKey);
    }
  };

  // Load Month Data
  const loadMonthData = async (targetYear: number, targetMonth: number) => {
    setLoading(true);
    const res = await getWorkCalendarMonthAction({ year: targetYear, month: targetMonth });
    setLoading(false);
    if (res.success && res.calendar) {
      setCalendar(res.calendar);
      setYear(targetYear);
      setMonth(targetMonth);
    } else {
      toast.error(res.error || 'Failed to load month calendar');
    }
  };

  const handlePrevMonth = () => {
    let nextMonth = month - 1;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }
    loadMonthData(nextYear, nextMonth);
  };

  const handleNextMonth = () => {
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    loadMonthData(nextYear, nextMonth);
  };

  const handleJumpToday = () => {
    const now = new Date();
    loadMonthData(now.getFullYear(), now.getMonth() + 1);
  };

  // Realtime subscription: immediate updates on punch-in, checkout, leave, or calendar events
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;
        if (
          detail.type === 'CALENDAR_UPDATE' ||
          detail.type === 'LEAVE_STATUS_CHANGED' ||
          detail.type === 'WORKFORCE_UPDATE' ||
          detail.type === 'ATTENDANCE_UPDATE' ||
          detail.table === 'Attendance'
        ) {
          loadMonthData(year, month);
          // Invalidate cached date breakdown so popovers show freshly updated lists
          setDateDetailsCache({});
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [year, month]);

  // Open Add Holiday
  const openAddHoliday = (prefillDate?: string) => {
    const defaultDate = prefillDate || `${year}-${String(month).padStart(2, '0')}-01`;
    setFormStartDate(defaultDate);
    setFormEndDate(defaultDate);
    setFormTitle('');
    setFormDescription('');
    setFormNotify(true);
    setHolidayModalOpen(true);
  };

  // Open Add Special Working Day
  const openAddSpecialDay = (prefillDate?: string) => {
    const defaultDate = prefillDate || `${year}-${String(month).padStart(2, '0')}-01`;
    setFormStartDate(defaultDate);
    setFormTitle('Special Working Day');
    setFormDescription('');
    setFormNotify(true);
    setSpecialDayModalOpen(true);
  };

  // Submit Holiday
  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Please enter a holiday title.');
      return;
    }
    if (!formStartDate) {
      toast.error('Please select a date.');
      return;
    }

    setActionLoading(true);
    const res = await addCompanyHolidayAction({
      date: formStartDate,
      endDate: formEndDate && formEndDate >= formStartDate ? formEndDate : formStartDate,
      title: formTitle.trim(),
      description: formDescription.trim(),
      notifyUsers: formNotify,
    });
    setActionLoading(false);

    if (res.success) {
      toast.success(res.message || 'Holiday added successfully!');
      setHolidayModalOpen(false);
      loadMonthData(year, month);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to add holiday.');
    }
  };

  // Submit Special Working Day
  const handleSaveSpecialDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStartDate) {
      toast.error('Please select a date.');
      return;
    }

    setActionLoading(true);
    const res = await addSpecialWorkingDayAction({
      date: formStartDate,
      title: formTitle.trim() || 'Special Working Day',
      description: formDescription.trim(),
      notifyUsers: formNotify,
    });
    setActionLoading(false);

    if (res.success) {
      toast.success(res.message || 'Special working day scheduled successfully!');
      setSpecialDayModalOpen(false);
      loadMonthData(year, month);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to add special working day.');
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to remove this calendar entry?')) return;
    setActionLoading(true);
    const res = await deleteCalendarEntryAction(id);
    setActionLoading(false);

    if (res.success) {
      toast.success(res.message || 'Calendar entry removed.');
      setEditingEntry(null);
      loadMonthData(year, month);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to delete entry.');
    }
  };

  // Update Holiday
  const handleUpdateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    setActionLoading(true);
    const res = await updateCompanyHolidayAction({
      id: editingEntry.id,
      title: formTitle.trim() || editingEntry.title,
      description: formDescription.trim(),
    });
    setActionLoading(false);

    if (res.success) {
      toast.success('Holiday updated successfully.');
      setEditingEntry(null);
      loadMonthData(year, month);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to update holiday.');
    }
  };

  // Compute leading padding blanks for the calendar grid
  const firstDayOfMonthIndex = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlanks = Array.from({ length: firstDayOfMonthIndex }, (_, i) => i);

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto">
      {/* Compact Calendar Header */}
      <div className="ws-card px-4 py-3 rounded-xl border-l-4 border-l-violet-500">
        {/* Row 1: Title + month nav + actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-2">
                Work Calendar
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isManager ? 'Manage holidays, special days, and weekly offs' : 'Corporate schedule and your personal leaves'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Month nav */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={handlePrevMonth} className="p-1.5 rounded-l-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer" title="Previous Month"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button onClick={handleJumpToday} className="px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-violet-600 transition cursor-pointer font-mono">{MONTH_NAMES[month - 1]} {year}</button>
              <button onClick={handleNextMonth} className="p-1.5 rounded-r-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer" title="Next Month"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>

            {isManager && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => openAddHoliday()} className="h-8 px-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Holiday
                </button>
                <button onClick={() => openAddSpecialDay()} className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer">
                  <Sparkles className="w-3.5 h-3.5" /> Special Day
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Stat tiles */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Total Days</div>
            <div className="text-base font-black text-slate-900 dark:text-white font-mono">{calendar.calendarDaysCount}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Working Days</div>
            <div className="text-base font-black text-blue-700 dark:text-blue-400 font-mono">{calendar.workingDaysCount}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Weekly Offs</div>
            <div className="text-base font-black text-amber-700 dark:text-amber-400 font-mono">{calendar.weeklyOffsCount}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Holidays</div>
            <div className="text-base font-black text-violet-700 dark:text-violet-400 font-mono">{calendar.companyHolidaysCount}</div>
          </div>

          {/* Personal Attendance summary cards for Employee / Team Lead */}
          {!isManager && (
            <>
              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-3 py-1.5">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase tracking-wider">Present</div>
                <div className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono">{calendar.presentDaysCount ?? 0}</div>
              </div>
              <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-lg px-3 py-1.5">
                <div className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold uppercase tracking-wider">Absent</div>
                <div className="text-base font-black text-rose-700 dark:text-rose-400 font-mono">{calendar.absentDaysCount ?? 0}</div>
              </div>
              {(calendar.halfDaysCount ?? 0) > 0 && (
                <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-1.5">
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wider">Half Day</div>
                  <div className="text-base font-black text-amber-700 dark:text-amber-400 font-mono">{calendar.halfDaysCount}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>


      {/* Compact Legend Bar */}
      <div className="ws-card px-3 py-1.5 rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 font-semibold uppercase text-[9.5px] tracking-wider">Legend:</span>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
            <span className="text-slate-600 dark:text-slate-400">Working Day</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-700" />
            <span className="text-amber-700 dark:text-amber-300 font-semibold">Weekly Off (Wed)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-100 dark:bg-purple-950 border border-purple-300 dark:border-purple-700" />
            <span className="text-purple-700 dark:text-purple-300 font-semibold">Holiday</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700" />
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Special Working</span>
          </div>

          {!isManager ? (
            <>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Present / Punched In</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 border border-amber-600" />
                <span className="text-amber-700 dark:text-amber-400 font-semibold">Half Day</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 border border-rose-600" />
                <span className="text-rose-700 dark:text-rose-400 font-semibold">Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 border border-blue-600" />
                <span className="text-blue-600 dark:text-blue-400 font-semibold">Your Leave</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Present Count</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-rose-700 dark:text-rose-400 font-semibold">Absent Count</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 border border-blue-600" />
                <span className="text-blue-600 dark:text-blue-400 font-semibold">Approved Leaves</span>
              </div>
            </>
          )}
        </div>

        <div className="text-[10.5px] text-slate-400 flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>Wednesday is default weekly off</span>
        </div>
      </div>

      {/* Main Month Calendar Grid (Compact Viewport Sizing) */}
      <div className="ws-card overflow-hidden shadow-2xs transition-colors">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold text-[11px] text-center py-1.5">
          {WEEKDAY_HEADERS.map((h, idx) => (
            <div
              key={h.short}
              className={`px-1 ${idx === 3 ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}`}
            >
              <span className="sm:hidden">{h.short}</span>
              <span className="hidden sm:inline">{h.full}</span>
            </div>
          ))}
        </div>

        {/* Calendar Day Tiles */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/70">
          {/* Leading Blanks */}
          {leadingBlanks.map((b) => (
            <div key={`blank-${b}`} className="h-[60px] sm:h-[68px] lg:h-[74px] bg-slate-50/40 dark:bg-slate-950/30 p-1" />
          ))}

          {/* Actual Month Days */}
          {calendar.days.map((day) => {
            const isToday = day.dateKey === todayKey;

            // Compute approved leaves for Manager view with deduplication
            const rawLeaves = day.leaves || [];
            const approvedLeavesMap = new Map<string, (typeof rawLeaves)[0]>();
            for (const l of rawLeaves) {
              if (l.currentStage === 'APPROVED' && !approvedLeavesMap.has(l.id)) {
                approvedLeavesMap.set(l.id, l);
              }
            }
            const approvedLeaves = Array.from(approvedLeavesMap.values());
            const approvedCount = approvedLeaves.length;
            const isPopoverOpen = isManager && approvedCount > 0 && (hoveredDateKey === day.dateKey || pinnedDateKey === day.dateKey);

            const isAttendancePopoverOpen = isManager && activeAttendancePopover?.dateKey === day.dateKey;
            const popoverType = activeAttendancePopover?.type || 'PRESENT';

            return (
              <div
                key={day.dateKey}
                className={`min-h-[68px] sm:min-h-[76px] lg:min-h-[82px] p-1 sm:p-1.5 transition relative flex flex-col justify-between group ${
                  isPopoverOpen || isAttendancePopoverOpen ? 'z-30' : 'z-0'
                } ${
                  day.isCompanyHoliday
                    ? 'bg-purple-50/60 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/30'
                    : day.isSpecialWorkingDay
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                    : day.isWeeklyOff
                    ? 'bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/70 dark:hover:bg-amber-950/20'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                } ${isToday ? 'ring-2 ring-blue-500 ring-inset z-10' : ''}`}
              >
                {/* Date Header Row */}
                <div className="flex justify-between items-center leading-none">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[11px] sm:text-xs font-bold font-mono ${
                        isToday
                          ? 'w-4.5 h-4.5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xs'
                          : day.isWeeklyOff
                          ? 'text-amber-600 dark:text-amber-400'
                          : day.isCompanyHoliday
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {day.dayNumber}
                    </span>
                    {isToday && (
                      <span className="hidden lg:inline-block text-[8.5px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Manager Quick Actions */}
                  {isManager && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      {day.overrideEntry ? (
                        <button
                          onClick={() => {
                            if (day.overrideEntry) {
                              setEditingEntry(day.overrideEntry);
                              setFormTitle(day.overrideEntry.title);
                              setFormDescription(day.overrideEntry.description || '');
                            }
                          }}
                          className="p-0.5 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Edit Entry"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (day.isWeeklyOff) openAddSpecialDay(day.dateKey);
                            else openAddHoliday(day.dateKey);
                          }}
                          className="p-0.5 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Add holiday or special working day"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Day Tags & Indicators */}
                <div className="space-y-0.5 flex-1 flex flex-col justify-end mt-1">
                  {/* Company Holiday Tag */}
                  {day.isCompanyHoliday && (
                    <div
                      onClick={() => {
                        if (isManager && day.overrideEntry) {
                          setEditingEntry(day.overrideEntry);
                          setFormTitle(day.overrideEntry.title);
                          setFormDescription(day.overrideEntry.description || '');
                        }
                      }}
                      className="px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-800 text-[9px] sm:text-[9.5px] font-semibold text-purple-900 dark:text-purple-200 leading-tight truncate cursor-pointer"
                      title={day.overrideEntry?.title || 'Company Holiday'}
                    >
                      ★ {day.overrideEntry?.title || 'Holiday'}
                    </div>
                  )}

                  {/* Special Working Day Tag */}
                  {day.isSpecialWorkingDay && (
                    <div
                      onClick={() => {
                        if (isManager && day.overrideEntry) {
                          setEditingEntry(day.overrideEntry);
                          setFormTitle(day.overrideEntry.title);
                          setFormDescription(day.overrideEntry.description || '');
                        }
                      }}
                      className="px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-[9px] sm:text-[9.5px] font-semibold text-emerald-900 dark:text-emerald-200 leading-tight truncate cursor-pointer"
                      title={day.overrideEntry?.title || 'Special Working Day'}
                    >
                      ⚡ {day.overrideEntry?.title || 'Working Day'}
                    </div>
                  )}

                  {/* Weekly Off Tag */}
                  {day.isWeeklyOff && !day.isCompanyHoliday && !day.isSpecialWorkingDay && (
                    <div className="px-1 py-0.2 rounded text-amber-700 dark:text-amber-400 text-[9px] font-medium truncate">
                      Weekly Off
                    </div>
                  )}

                  {/* LEAVE DISPLAY */}
                  {isManager ? (
                    // MANAGER VIEW: Compact leave indicator pill + Popover
                    approvedCount > 0 && (
                      <div
                        className="relative pt-0.5"
                        onMouseEnter={() => setHoveredDateKey(day.dateKey)}
                        onMouseLeave={() => setHoveredDateKey(null)}
                      >
                        {/* Compact Indicator Pill */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinnedDateKey((prev) => (prev === day.dateKey ? null : day.dateKey));
                          }}
                          className="w-full text-left px-1.5 py-0.5 rounded-md bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-[9px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition flex items-center justify-between gap-1 shadow-2xs cursor-pointer group/pill"
                          title={`${approvedCount} approved ${approvedCount === 1 ? 'leave' : 'leaves'} on this date. Click or hover to view details.`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                            <span className="truncate">{approvedCount} {approvedCount === 1 ? 'leave' : 'leaves'}</span>
                          </span>
                        </button>

                        {/* Floating Details Popover Card for Leaves */}
                        {isPopoverOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute z-50 w-64 sm:w-72 ws-card shadow-2xl p-3 text-xs animate-in fade-in-50 zoom-in-95 duration-100 text-left ${
                              day.dayNumber <= 7 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                            } ${day.dayOfWeek >= 4 ? 'right-0' : 'left-0'}`}
                          >
                            {/* Popover Header */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CalendarDays className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                                  Approved Leaves &middot; {MONTH_NAMES[month - 1].slice(0, 3)} {day.dayNumber}
                                </span>
                              </div>
                              <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-[9.5px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                                {approvedCount} {approvedCount === 1 ? 'leave' : 'leaves'}
                              </span>
                            </div>

                            {/* Scrollable List of Approved Leaves */}
                            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
                              {approvedLeaves.map((l, idx) => {
                                const isHalfDay = l.numberOfDays === 0.5;
                                const durationLabel = isHalfDay ? 'Half Day' : `${l.numberOfDays} ${l.numberOfDays === 1 ? 'Day' : 'Days'}`;
                                const isPaid = l.payTreatment === 'PAID';

                                return (
                                  <div key={l.id || idx} className={`${idx > 0 ? 'pt-2' : ''} space-y-0.5`}>
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate">
                                          {l.userName || 'Employee'}
                                        </span>
                                        {l.userRole === 'TEAM_LEAD' && (
                                          <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                                            TL
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border shrink-0 ${
                                          isPaid
                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                        }`}
                                      >
                                        {isPaid ? 'Paid' : 'Unpaid'}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                      <span className="font-medium text-violet-600 dark:text-violet-400">
                                        {l.leaveType.replace(/_/g, ' ')} &middot; {durationLabel}
                                      </span>
                                      {l.teamName && (
                                        <span className="truncate max-w-[100px] text-slate-400">
                                          {l.teamName}
                                        </span>
                                      )}
                                    </div>

                                    {l.reason && (
                                      <p className="text-[10px] text-slate-600 dark:text-slate-400 italic line-clamp-2">
                                        &ldquo;{l.reason}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    // EMPLOYEE / TEAM LEAD PERSONAL VIEW: Show user's own leave badge
                    day.leaves && day.leaves.length > 0 && (
                      <div className="space-y-0.5 pt-0.5">
                        {day.leaves.map((l) => {
                          const statusLabel =
                            l.currentStage === 'APPROVED'
                              ? l.payTreatment === 'PAID'
                                ? 'Approved / Paid'
                                : 'Approved'
                              : l.currentStage === 'REJECTED'
                              ? 'Rejected'
                              : 'Pending';

                          return (
                            <div
                              key={l.id}
                              className={`px-1 py-0.5 rounded border text-[8.5px] font-semibold leading-tight truncate ${
                                l.currentStage === 'APPROVED'
                                  ? l.payTreatment === 'PAID'
                                    ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                                    : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  : l.currentStage === 'REJECTED'
                                  ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                  : 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                              }`}
                              title={`My Leave: ${l.leaveType.replace(/_/g, ' ')} (${statusLabel}) - ${l.reason}`}
                            >
                              My Leave: {statusLabel}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* ATTENDANCE SECTION */}
                  {isManager ? (
                    // MANAGER VIEW: Live Attendance Counts (Present & Absent) with Hover/Tap Popover
                    day.attendanceSummary && (
                      <div className="space-y-0.5 mt-auto pt-0.5 relative">
                        {/* Present Count Pill */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleAttendancePopover(day.dateKey, 'PRESENT', e)}
                          onMouseEnter={() => handleHoverAttendancePopover(day.dateKey, 'PRESENT')}
                          onMouseLeave={handleLeaveAttendancePopover}
                          className="w-full text-left px-1.5 py-0.5 rounded-md bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition flex items-center justify-between gap-1 shadow-2xs cursor-pointer"
                          title={`${day.attendanceSummary.presentCount} present on this date. Click or hover to view workforce.`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                            <span className="truncate">Present: {day.attendanceSummary.presentCount}</span>
                          </span>
                        </button>

                        {/* Absent Count Pill (or Pending for Today) */}
                        {day.attendanceSummary.absentCount > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => handleToggleAttendancePopover(day.dateKey, 'ABSENT', e)}
                            onMouseEnter={() => handleHoverAttendancePopover(day.dateKey, 'ABSENT')}
                            onMouseLeave={handleLeaveAttendancePopover}
                            className="w-full text-left px-1.5 py-0.5 rounded-md bg-rose-50/90 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-[9px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition flex items-center justify-between gap-1 shadow-2xs cursor-pointer"
                            title={`${day.attendanceSummary.absentCount} absent on this date. Click or hover to view workforce.`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 shrink-0" />
                              <span className="truncate">Absent: {day.attendanceSummary.absentCount}</span>
                            </span>
                          </button>
                        ) : isToday && day.attendanceSummary.pendingCount > 0 ? (
                          <div
                            className="w-full text-left px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[8.5px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1"
                            title={`${day.attendanceSummary.pendingCount} employees have not punched in yet today`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span className="truncate">Pending: {day.attendanceSummary.pendingCount}</span>
                          </div>
                        ) : null}

                        {/* Floating Attendance Details Popover Card for Manager */}
                        {isAttendancePopoverOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute z-50 w-72 sm:w-80 ws-card shadow-2xl p-3 text-xs animate-in fade-in-50 zoom-in-95 duration-100 text-left ${
                              day.dayNumber <= 7 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                            } ${day.dayOfWeek >= 4 ? 'right-0' : 'left-0'}`}
                          >
                            {/* Popover Header */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {popoverType === 'PRESENT' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                ) : (
                                  <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                )}
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                                  {popoverType === 'PRESENT' ? 'Present Workforce' : 'Absent Workforce'} &middot; {MONTH_NAMES[month - 1].slice(0, 3)} {day.dayNumber}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-bold border ${
                                    popoverType === 'PRESENT'
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                  }`}
                                >
                                  {popoverType === 'PRESENT'
                                    ? `${day.attendanceSummary?.presentCount ?? 0} present`
                                    : `${day.attendanceSummary?.absentCount ?? 0} absent`}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveAttendancePopover(null);
                                  }}
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Type Switcher tabs inside popover */}
                            <div className="flex items-center gap-1 mb-2 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10.5px]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveAttendancePopover((prev) => prev ? { ...prev, type: 'PRESENT' } : null);
                                }}
                                className={`flex-1 py-1 rounded-md font-semibold transition cursor-pointer text-center ${
                                  popoverType === 'PRESENT'
                                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                              >
                                Present ({day.attendanceSummary?.presentCount ?? 0})
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveAttendancePopover((prev) => prev ? { ...prev, type: 'ABSENT' } : null);
                                }}
                                className={`flex-1 py-1 rounded-md font-semibold transition cursor-pointer text-center ${
                                  popoverType === 'ABSENT'
                                    ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-2xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                              >
                                Absent ({day.attendanceSummary?.absentCount ?? 0})
                              </button>
                            </div>

                            {/* Popover List Content */}
                            {loadingDateDetails && !dateDetailsCache[day.dateKey] ? (
                              <div className="py-6 flex items-center justify-center gap-2 text-slate-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                <span>Loading workforce...</span>
                              </div>
                            ) : (
                              (() => {
                                const details = dateDetailsCache[day.dateKey];
                                const list = popoverType === 'PRESENT'
                                  ? (details?.presentEmployees || [])
                                  : (details?.absentEmployees || []);
                                const halfDays = popoverType === 'PRESENT' ? (details?.halfDayEmployees || []) : [];

                                if (list.length === 0 && halfDays.length === 0) {
                                  return (
                                    <div className="py-4 text-center text-slate-400 italic text-[11px]">
                                      {popoverType === 'PRESENT' ? 'No employees present on this date' : 'No absences recorded on this date'}
                                    </div>
                                  );
                                }

                                return (
                                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {list.map((emp: any, idx: number) => (
                                      <div key={emp.id || idx} className={`${idx > 0 ? 'pt-2' : ''} space-y-0.5`}>
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate">
                                              {emp.fullName}
                                            </span>
                                            {emp.role === 'TEAM_LEAD' && (
                                              <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                                                TL
                                              </span>
                                            )}
                                          </div>
                                          <span
                                            className={`px-1.5 py-0.2 rounded text-[8.5px] font-semibold border shrink-0 ${
                                              emp.status === 'PUNCHED_IN'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                                : emp.status === 'PRESENT'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                            }`}
                                          >
                                            {emp.status === 'PUNCHED_IN' ? 'Punched In' : emp.status === 'PRESENT' ? 'Present' : 'Absent'}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                          <span className="font-mono text-[9.5px] text-slate-400">
                                            {emp.employeeId}
                                          </span>
                                          {emp.checkInTime && (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                              In: {emp.checkInTime}
                                            </span>
                                          )}
                                          {emp.teamName && !emp.checkInTime && (
                                            <span className="text-slate-400 truncate max-w-[110px]">
                                              {emp.teamName}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}

                                    {/* If Present tab, also display half-day employees if any */}
                                    {halfDays.length > 0 && (
                                      <div className="pt-2">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                                          Half Day ({halfDays.length})
                                        </div>
                                        {halfDays.map((emp: any, idx: number) => (
                                          <div key={`hd-${emp.id || idx}`} className="space-y-0.5 mb-1.5">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate">
                                                {emp.fullName}
                                              </span>
                                              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                                                Half Day
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                              <span className="font-mono text-[9.5px]">{emp.employeeId}</span>
                                              {emp.checkInTime && <span className="text-amber-600 font-medium">In: {emp.checkInTime}</span>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    // EMPLOYEE / TEAM LEAD PERSONAL VIEW: Live Attendance Indicator
                    day.attendance && (
                      <div className="mt-auto pt-0.5">
                        {day.attendance.isPunchedIn ? (
                          <div
                            className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-[9px] font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1 shadow-2xs leading-tight truncate"
                            title="You are currently punched in for today"
                          >
                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600 dark:bg-emerald-400"></span>
                            </span>
                            <span className="truncate">Punched In</span>
                          </div>
                        ) : day.attendance.status === 'PRESENT' ? (
                          <div
                            className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 leading-tight truncate"
                            title={`Present (${day.attendance.totalHours > 0 ? `${day.attendance.totalHours} hrs` : 'Completed'})`}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">Present</span>
                          </div>
                        ) : day.attendance.status === 'HALF_DAY' ? (
                          <div
                            className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-[9px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1 leading-tight truncate"
                            title={`Half Day (${day.attendance.totalHours} hrs)`}
                          >
                            <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="truncate">Half Day</span>
                          </div>
                        ) : day.attendance.status === 'ABSENT' ? (
                          <div
                            className="px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-[9px] font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1 leading-tight truncate"
                            title="Officially recorded as Absent"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 shrink-0" />
                            <span className="truncate">Absent</span>
                          </div>
                        ) : isToday && day.attendance.status === 'PENDING' ? (
                          <div
                            className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[8.5px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 leading-tight truncate"
                            title="You have not punched in yet today"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span className="truncate">Not Punched In</span>
                          </div>
                        ) : null}
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD COMPANY HOLIDAY MODAL (Manager Only) */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ws-card max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Declare Company Holiday
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Add official holiday to corporate calendar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHolidayModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Holiday Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day, Diwali, Annual Gala"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    End Date <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Description / Note <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional information for workforce..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formNotify}
                  onChange={(e) => setFormNotify(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Send system notification to all employees and team leads
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setHolidayModalOpen(false)}
                  className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SPECIAL WORKING DAY MODAL (Manager Only) */}
      {specialDayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ws-card max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Declare Special Working Day
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Override Wednesday weekly off or schedule working day
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSpecialDayModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSpecialDay} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Target Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Title / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Compensatory Working Day, Sprint Closing"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Description / Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes for employees..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formNotify}
                  onChange={(e) => setFormNotify(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Send system notification to workforce
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSpecialDayModalOpen(false)}
                  className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Schedule Working Day
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / DELETE ENTRY MODAL (Manager Only) */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ws-card max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Manage Calendar Entry &middot; {editingEntry.dateKey}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {editingEntry.type === 'COMPANY_HOLIDAY' ? 'Company Holiday' : 'Special Working Day'}
                </p>
              </div>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateHoliday} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleDeleteEntry(editingEntry.id)}
                  className="px-3 py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-semibold rounded-xl transition border border-rose-200 dark:border-rose-800/60 flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Entry
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingEntry(null)}
                    className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
