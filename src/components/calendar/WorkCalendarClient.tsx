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

  const todayKey = getTodayIndiaDateKey();
  const isManager = role === 'MANAGER';

  // Close pinned popovers when clicking elsewhere on the window
  useEffect(() => {
    const handleGlobalClick = () => {
      setPinnedDateKey(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

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

  // Realtime subscription
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;
        if (
          detail.type === 'CALENDAR_UPDATE' ||
          detail.type === 'LEAVE_STATUS_CHANGED' ||
          detail.type === 'WORKFORCE_UPDATE'
        ) {
          loadMonthData(year, month);
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
      {/* Top Header Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Work Calendar &middot; {MONTH_NAMES[month - 1]} {year}
              </h2>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isManager
                ? 'Corporate schedule, Wednesday weekly offs, holidays & special working day overrides'
                : 'Corporate working schedule and your personal leaves'}
            </p>
          </div>
        </div>

        {/* Month Navigation & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleJumpToday}
              className="px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer font-mono"
            >
              {MONTH_NAMES[month - 1]} {year}
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isManager && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openAddHoliday()}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Holiday
              </button>
              <button
                onClick={() => openAddSpecialDay()}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Special Day
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Bar (Compact) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Days:</span>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
            {calendar.calendarDaysCount} Days
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Working Days:</span>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
            {calendar.workingDaysCount} Days
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Weekly Offs (Wed):</span>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
            {calendar.weeklyOffsCount} Days
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Holidays:</span>
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 font-mono">
            {calendar.companyHolidaysCount} Days
          </span>
        </div>
      </div>

      {/* Compact Legend Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-2 text-[11px]">
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
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 border border-blue-600" />
            <span className="text-blue-600 dark:text-blue-400 font-semibold">Your Leave</span>
          </div>
        </div>

        <div className="text-[10.5px] text-slate-400 flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>Wednesday is default weekly off</span>
        </div>
      </div>

      {/* Main Month Calendar Grid (Compact Viewport Sizing) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs transition-colors">
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

            return (
              <div
                key={day.dateKey}
                className={`min-h-[64px] sm:min-h-[72px] lg:min-h-[78px] p-1 sm:p-1.5 transition relative flex flex-col justify-between group ${
                  isPopoverOpen ? 'z-30' : 'z-0'
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
                    // MANAGER VIEW: Compact indicator pill + Popover
                    approvedCount > 0 && (
                      <div
                        className="relative mt-auto pt-0.5"
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

                        {/* Floating Details Popover Card */}
                        {isPopoverOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute z-50 w-64 sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-3 text-xs animate-in fade-in-50 zoom-in-95 duration-100 text-left ${
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
                      <div className="space-y-0.5 mt-auto pt-0.5">
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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD COMPANY HOLIDAY MODAL (Manager Only) */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
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
