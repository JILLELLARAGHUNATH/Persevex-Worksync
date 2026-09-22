'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Banknote,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Eye,
  Edit,
  Loader2,
  Users,
  Layers,
  ArrowUpDown,
  Download,
  ShieldCheck,
  X,
  FileCheck2,
  Clock,
  Briefcase,
  Plus,
  Info,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { MonthPayrollSummary, EmployeePayrollCalculation } from '@/lib/payroll';
import {
  getMonthlyPayrollAction,
  getEmployeePayrollDetailAction,
  saveEmployeeSalaryAction,
  finalizeMonthlyPayrollAction,
  recalculateMonthlyPayrollAction,
  exportMonthlyPayrollReportAction,
  downloadEmployeePayslipAction,
} from '@/actions/payrollActions';
import { downloadEmployeePayslipPdf } from '@/lib/payslipPdf';
import { formatDate, getIndiaDateKey } from '@/lib/utils';

interface Props {
  initialSummary: MonthPayrollSummary;
  initialYear: number;
  initialMonth: number;
  teams: Array<{ id: string; name: string }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function SalaryPayrollClient({
  initialSummary,
  initialYear,
  initialMonth,
  teams,
}: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState<MonthPayrollSummary>(initialSummary);
  const [year, setYear] = useState<number>(initialYear);
  const [month, setMonth] = useState<number>(initialMonth);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals
  const [detailModalUser, setDetailModalUser] = useState<EmployeePayrollCalculation | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [downloadingPayslip, setDownloadingPayslip] = useState<boolean>(false);

  const [salaryModalUser, setSalaryModalUser] = useState<EmployeePayrollCalculation | null>(null);
  const [formSalary, setFormSalary] = useState<number>(0);
  const [formEmploymentType, setFormEmploymentType] = useState<string>('FULL_TIME');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState<string>('');
  const [formJoiningDate, setFormJoiningDate] = useState<string>('');
  const [formExitDate, setFormExitDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Load Month Payroll
  const loadPayrollData = async (targetYear: number, targetMonth: number) => {
    setLoading(true);
    const res = await getMonthlyPayrollAction({
      year: targetYear,
      month: targetMonth,
      search: searchQuery,
      teamId: selectedTeam,
      status: statusFilter,
    });
    setLoading(false);
    if (res.success && res.summary) {
      setSummary(res.summary);
      setYear(targetYear);
      setMonth(targetMonth);
    } else {
      toast.error(res.error || 'Failed to load payroll summary');
    }
  };

  const handlePrevMonth = () => {
    let nextMonth = month - 1;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }
    loadPayrollData(nextYear, nextMonth);
  };

  const handleNextMonth = () => {
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    loadPayrollData(nextYear, nextMonth);
  };

  // Realtime Sync with month-scoping and debouncing
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const monthStartKey = `${selectedMonthKey}-01`;
    const monthEndKey = `${selectedMonthKey}-${String(totalDaysInMonth).padStart(2, '0')}`;

    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail || !detail.type) return;

        const type = detail.type;
        const payload = detail.payload || {};

        // Month-scoped event validation (Correction 3)
        if (type === 'ATTENDANCE_UPDATE') {
          const attDate = payload.attendance?.date || payload.date;
          if (attDate) {
            const dateKey = getIndiaDateKey(attDate);
            if (dateKey && (dateKey < monthStartKey || dateKey > monthEndKey)) {
              return; // Event affects a different month, ignore
            }
          }
        } else if (type === 'LEAVE_STATUS_CHANGED') {
          const leave = payload.leave;
          if (leave?.startDate && leave?.endDate) {
            const startKey = getIndiaDateKey(leave.startDate);
            const endKey = getIndiaDateKey(leave.endDate);
            if (startKey && endKey && (startKey > monthEndKey || endKey < monthStartKey)) {
              return; // Leave is entirely outside the selected month, ignore
            }
          }
        } else if (type === 'CALENDAR_UPDATE') {
          const entryDate = payload.entry?.dateKey || payload.entry?.date;
          if (entryDate) {
            const dateKey = typeof entryDate === 'string' && entryDate.length === 10 ? entryDate : getIndiaDateKey(entryDate);
            if (dateKey && (dateKey < monthStartKey || dateKey > monthEndKey)) {
              return; // Calendar override is outside the selected month, ignore
            }
          }
        } else if (type === 'PAYROLL_UPDATE') {
          if (payload.year && payload.month) {
            if (Number(payload.year) !== year || Number(payload.month) !== month) {
              return; // Payroll update for another month, ignore
            }
          }
        }

        if (
          type === 'PAYROLL_UPDATE' ||
          type === 'CALENDAR_UPDATE' ||
          type === 'LEAVE_STATUS_CHANGED' ||
          type === 'ATTENDANCE_UPDATE' ||
          type === 'WORKFORCE_UPDATE'
        ) {
          clearTimeout(timeout);
          // Coalesce rapid events (300ms debounce window)
          timeout = setTimeout(() => {
            loadPayrollData(year, month);
          }, 300);
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('persevex-realtime', handleRealtime);
    };
  }, [year, month, searchQuery, selectedTeam, statusFilter]);

  // Open Detail Modal
  const openDetailModal = async (emp: EmployeePayrollCalculation) => {
    setDetailModalUser(emp);
    setDetailLoading(true);
    const res = await getEmployeePayrollDetailAction({
      userId: emp.userId,
      year,
      month,
    });
    setDetailLoading(false);
    if (res.success && res.detail) {
      setDetailData(res.detail);
    } else {
      toast.error(res.error || 'Failed to load detailed payroll breakdown');
    }
  };

  // Open Salary Edit Modal
  const openSalaryModal = async (emp: EmployeePayrollCalculation) => {
    setSalaryModalUser(emp);
    setFormSalary(emp.baseSalary || 0);
    setFormEmploymentType(emp.employmentType || 'FULL_TIME');
    const defaultEffectiveDate = emp.salaryEffectiveFrom
      ? new Date(emp.salaryEffectiveFrom).toISOString().split('T')[0]
      : `${year}-${String(month).padStart(2, '0')}-01`;
    setFormEffectiveFrom(defaultEffectiveDate);
    setFormJoiningDate('');
    setFormExitDate('');
    setFormNotes(emp.notes || '');

    // Fetch existing employee detail to prefill joiningDate and exitDate
    const res = await getEmployeePayrollDetailAction({
      userId: emp.userId,
      year,
      month,
    });
    if (res.success && res.detail) {
      if (res.detail.joiningDate) {
        setFormJoiningDate(new Date(res.detail.joiningDate).toISOString().split('T')[0]);
      }
      if (res.detail.exitDate) {
        setFormExitDate(new Date(res.detail.exitDate).toISOString().split('T')[0]);
      }
    }
  };

  // Save Salary
  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryModalUser) return;
    if (formSalary < 0) {
      toast.error('Salary cannot be negative.');
      return;
    }

    setActionLoading(true);
    const res = await saveEmployeeSalaryAction({
      userId: salaryModalUser.userId,
      baseSalary: formSalary,
      employmentType: formEmploymentType,
      effectiveFrom: formEffectiveFrom,
      joiningDate: formJoiningDate || undefined,
      exitDate: formExitDate || null,
      notes: formNotes,
    });
    setActionLoading(false);

    if (res.success) {
      toast.success(res.message || 'Payroll details updated successfully!');
      setSalaryModalUser(null);
      loadPayrollData(year, month);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to update payroll master details');
    }
  };

  // Finalize Month Payroll (Modal Trigger & Confirmation)
  const confirmFinalizePayroll = async () => {
    setActionLoading(true);
    const res = await finalizeMonthlyPayrollAction({ year, month });
    setActionLoading(false);
    setFinalizeModalOpen(false);

    if (res.success) {
      toast.success(res.message || `Monthly payroll for ${MONTH_NAMES[month - 1]} ${year} finalized!`);
      loadPayrollData(year, month);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to finalize payroll.');
    }
  };

  // Export Payroll Report (CSV / Excel)
  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExportLoading(true);
    setExportMenuOpen(false);
    try {
      const res = await exportMonthlyPayrollReportAction({ year, month, format });
      if (res.success && res.base64 && res.fileName) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const mimeType =
          format === 'csv'
            ? 'text/csv;charset=utf-8;'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const blob = new Blob([byteArray], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = res.fileName;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        toast.success(`Exported ${res.fileName}`);
      } else {
        toast.error(res.error || 'Failed to export payroll report.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Export error');
    } finally {
      setExportLoading(false);
    }
  };

  // Print / PDF View
  const handlePrintPDF = () => {
    setExportMenuOpen(false);
    window.print();
  };

  // Recalculate Month Payroll
  const handleRecalculateAll = async () => {
    setActionLoading(true);
    const res = await recalculateMonthlyPayrollAction({ year, month });
    setActionLoading(false);

    if (res.success) {
      toast.success(res.message || 'Payroll recalculation complete.');
      loadPayrollData(year, month);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to recalculate payroll.');
    }
  };

  // Download Individual Payslip PDF
  const handleDownloadPayslip = async () => {
    if (!detailModalUser) return;
    if (detailModalUser.baseSalary <= 0) {
      toast.error('Salary is not configured for this employee. Please configure base salary before downloading a payslip.');
      return;
    }
    try {
      setDownloadingPayslip(true);
      const res = await downloadEmployeePayslipAction({
        userId: detailModalUser.userId,
        year,
        month,
      });
      if (!res.success || !res.detail) {
        toast.error(res.error || 'Failed to authorize payslip download');
        return;
      }
      const pdfRes = await downloadEmployeePayslipPdf(res.detail, year, month);
      if (pdfRes.success) {
        toast.success(`Downloaded ${pdfRes.fileName}`);
      } else {
        toast.error(pdfRes.error || 'Failed to generate PDF document');
      }
    } catch (err: any) {
      toast.error(err?.message || 'An error occurred while generating the payslip PDF.');
    } finally {
      setDownloadingPayslip(false);
    }
  };

  // Client-side filtering if needed
  const filteredEmployees = useMemo(() => {
    let list = summary.employees || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.teamName.toLowerCase().includes(q)
      );
    }
    if (selectedTeam) {
      const teamObj = teams.find((t) => t.id === selectedTeam);
      if (teamObj) {
        list = list.filter((e) => e.teamName === teamObj.name);
      }
    }
    if (statusFilter) {
      list = list.filter((e) => e.status === statusFilter);
    }
    return list;
  }, [summary.employees, searchQuery, selectedTeam, statusFilter, teams]);

  const applicableWorkingDays =
    summary.applicableWorkingDays ??
    (summary.employees && summary.employees.length > 0 ? summary.employees[0].workingDays : 24);

  return (
    <div className="space-y-4">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg">
                Salary & Payroll &middot; {MONTH_NAMES[month - 1]} {year}
              </h1>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />}
              {summary.status === 'FINALIZED' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Finalized
                </span>
              )}
              {summary.status === 'RECALCULATION_REQUIRED' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Recalculation Required
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {MONTH_NAMES[month - 1]} {year} &middot; <span className="font-semibold text-slate-700 dark:text-slate-300">{applicableWorkingDays} applicable working days</span> &middot; Authoritative salary calculations & pay treatment
            </p>
          </div>
        </div>

        {/* Grouped & Vertically Aligned Right Side Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          {/* Month Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={handlePrevMonth}
              disabled={loading || actionLoading}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer disabled:opacity-50"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono select-none">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              disabled={loading || actionLoading}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer disabled:opacity-50"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Recalculate Button */}
          <button
            onClick={handleRecalculateAll}
            disabled={actionLoading || loading}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Recalculate this month with latest attendance, leaves, and calendar"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
            <span>Recalculate</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((prev) => !prev)}
              disabled={exportLoading || loading}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Export authoritative payroll data"
            >
              {exportLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              )}
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {exportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setExportMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Export {MONTH_NAMES[month - 1]} {year}
                    </p>
                  </div>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Download CSV</p>
                      <p className="text-[10px] text-slate-400">Comma-separated values (.csv)</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Download Excel</p>
                      <p className="text-[10px] text-slate-400">Microsoft Excel format (.xlsx)</p>
                    </div>
                  </button>
                  <button
                    onClick={handlePrintPDF}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition cursor-pointer border-t border-slate-100 dark:border-slate-800"
                  >
                    <Printer className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Print / Save as PDF</p>
                      <p className="text-[10px] text-slate-400">Formatted summary printout</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Finalize Month Button */}
          <button
            onClick={() => setFinalizeModalOpen(true)}
            disabled={actionLoading || loading || summary.status === 'FINALIZED'}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            title={summary.status === 'FINALIZED' ? 'This month is already finalized' : 'Review and lock authoritative payroll for this month'}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Finalize Month</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Workforce</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {summary.totalEmployees}
          </p>
          <span className="text-[10px] text-slate-400">Active Employees</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Monthly Salary</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            ₹{summary.totalMonthlySalary.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-400">Gross Master Base</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">TOTAL PAYABLE</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            ₹{summary.totalPayableSalary.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">Net Disbursement</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Approved Paid Leaves</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono mt-0.5">
            {summary.totalPaidLeaveDays}
          </p>
          <span className="text-[10px] text-blue-500">Days Entitled</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Unpaid Days</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
            {summary.totalUnpaidDays}
          </p>
          <span className="text-[10px] text-amber-500">Deduction Days</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee, ID, team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
            />
          </div>

          {/* Team Filter */}
          <div className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="h-8 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="CALCULATED">Calculated</option>
              <option value="FINALIZED">Finalized</option>
              <option value="RECALCULATION_REQUIRED">Recalculation Required</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 shrink-0">
          <span>{MONTH_NAMES[month - 1]} {year} &middot; <strong className="text-slate-700 dark:text-slate-300 font-semibold">{applicableWorkingDays} working days</strong></span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>Showing <strong className="text-slate-800 dark:text-slate-200 font-semibold">{filteredEmployees.length}</strong> of {summary.employees.length}</span>
        </div>
      </div>

      {/* Main Payroll Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs table-auto">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3 text-left w-[18%] min-w-[130px]">EMPLOYEE</th>
                <th className="py-2.5 px-2 text-right w-[10%] min-w-[90px]">
                  <div className="leading-tight">
                    <span>BASE</span>
                    <span className="block text-[9px] text-slate-400">SALARY</span>
                  </div>
                </th>
                <th className="py-2.5 px-1.5 text-center w-[6%] min-w-[45px]">PRESENT</th>
                <th className="py-2.5 px-1.5 text-center w-[6%] min-w-[50px]">
                  <div className="leading-tight">
                    <span>PAID</span>
                    <span className="block text-[9px] text-slate-400">LEAVE</span>
                  </div>
                </th>
                <th className="py-2.5 px-1.5 text-center w-[6%] min-w-[50px]">
                  <div className="leading-tight">
                    <span>UNPAID</span>
                    <span className="block text-[9px] text-slate-400">DAYS</span>
                  </div>
                </th>
                <th className="py-2.5 px-2 text-right w-[14%] min-w-[105px]">
                  <div className="inline-flex items-center gap-1 group relative cursor-help justify-end">
                    <div className="leading-tight text-right">
                      <span>PRESENT + PAID</span>
                      <span className="block text-[9px] text-slate-400">LEAVE SALARY</span>
                    </div>
                    <Info className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                    <div className="hidden group-hover:block absolute z-50 top-full right-0 mt-2 w-72 max-w-[280px] p-2.5 bg-slate-900 dark:bg-slate-800 text-slate-100 border border-slate-700 dark:border-slate-600 rounded-xl shadow-2xl pointer-events-none text-left normal-case leading-relaxed text-[11px] font-normal">
                      Salary attributable to present days and approved paid-leave days.
                    </div>
                  </div>
                </th>
                <th className="py-2.5 px-2 text-right w-[14%] min-w-[105px]">
                  <div className="inline-flex items-center gap-1 group relative cursor-help justify-end">
                    <div className="leading-tight text-right">
                      <span>WEEK OFF +</span>
                      <span className="block text-[9px] text-slate-400">HOLIDAY SALARY</span>
                    </div>
                    <Info className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                    <div className="hidden group-hover:block absolute z-50 top-full right-0 mt-2 w-72 max-w-[290px] p-2.5 bg-slate-900 dark:bg-slate-800 text-slate-100 border border-slate-700 dark:border-slate-600 rounded-xl shadow-2xl pointer-events-none text-left normal-case leading-relaxed text-[11px] font-normal">
                      Salary attributable to weekly offs and company holidays. These days are paid and are not deducted.
                    </div>
                  </div>
                </th>
                <th className="py-2.5 px-2 text-right w-[12%] min-w-[100px]">
                  <div className="inline-flex items-center gap-1 group relative cursor-help justify-end">
                    <div className="leading-tight text-right font-bold text-emerald-600 dark:text-emerald-400">
                      <span>TOTAL</span>
                      <span className="block text-[9px]">PAYABLE</span>
                    </div>
                    <Info className="w-3 h-3 text-emerald-500/70 group-hover:text-emerald-500 transition-colors shrink-0" />
                    <div className="hidden group-hover:block absolute z-50 top-full right-0 mt-2 w-60 max-w-[260px] p-2.5 bg-slate-900 dark:bg-slate-800 text-slate-100 border border-slate-700 dark:border-slate-600 rounded-xl shadow-2xl pointer-events-none text-left normal-case leading-relaxed text-[11px] font-normal">
                      Final payroll amount after applicable unpaid deductions.
                    </div>
                  </div>
                </th>
                <th className="py-2.5 px-1.5 text-center w-[8%] min-w-[75px]">STATUS</th>
                <th className="py-2.5 px-2 text-center w-[6%] min-w-[65px]">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No payroll records found for the selected month and filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const hasSalary = emp.baseSalary > 0;
                  const presentAndPaidSal = hasSalary
                    ? (emp.presentAndPaidLeaveSalary ?? Math.round((emp.presentDays + emp.paidLeaveDays) * (emp.baseSalary / (emp.calendarDays || 30)) * 100) / 100)
                    : 0;
                  const weekOffAndHolidaySal = hasSalary
                    ? (emp.weekOffAndHolidaySalary ?? Math.round((emp.weeklyOffs + emp.companyHolidays) * (emp.baseSalary / (emp.calendarDays || 30)) * 100) / 100)
                    : 0;

                  return (
                    <tr key={emp.userId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-left">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                          {emp.fullName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-x-1 gap-y-0.5 mt-0.5">
                          <span>{emp.employeeId}</span>
                          <span>&middot;</span>
                          <span className="truncate max-w-[90px]">{emp.teamName}</span>
                          <span>&middot;</span>
                          <span
                            className={`inline-flex items-center px-1 py-0.2 rounded text-[9px] font-semibold border ${
                              emp.employmentType === 'INTERN'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            {emp.employmentType === 'INTERN' ? 'Intern' : 'Full-Time'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {hasSalary ? (
                          <span>₹{emp.baseSalary.toLocaleString('en-IN')}</span>
                        ) : (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className="text-amber-600 dark:text-amber-400 text-[10px] font-semibold leading-none">Salary Not Set</span>
                            <button
                              onClick={() => openSalaryModal(emp)}
                              className="text-blue-600 dark:text-blue-400 hover:underline text-[9px] font-semibold cursor-pointer leading-none"
                            >
                              + Set Salary
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {emp.presentDays}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-mono text-blue-600 dark:text-blue-400">
                        {emp.paidLeaveDays}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {emp.unpaidLeaveDays}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {hasSalary ? (
                          <span>₹{presentAndPaidSal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {hasSalary ? (
                          <span>₹{weekOffAndHolidaySal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap">
                        {hasSalary ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">₹{emp.finalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-amber-600/90 dark:text-amber-400/90 font-medium text-[10px]">Salary Not Set</span>
                        )}
                      </td>
                      <td className="py-2.5 px-1.5 text-center">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border tracking-tight ${
                            emp.status === 'FINALIZED'
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : emp.status === 'RECALCULATION_REQUIRED'
                              ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openDetailModal(emp)}
                            className="p-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                            title="View Itemized Breakdown"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openSalaryModal(emp)}
                            className="p-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-lg transition border border-blue-200 dark:border-blue-800/60 cursor-pointer"
                            title="Edit Payroll Master Details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reference & Formula Explanatory Footer */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs space-y-2 text-slate-600 dark:text-slate-400 shadow-xs transition-colors">
        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100 text-xs">
          <Info className="w-4 h-4 text-blue-500" />
          <span>Salary Calculation & Component Reference</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 text-[11px] font-mono">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans font-semibold mb-0.5">Daily Salary Rate</span>
            Monthly Salary ÷ Calendar Days in Month
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <span className="text-blue-600 dark:text-blue-400 block text-[10px] uppercase font-sans font-semibold mb-0.5">Present + Paid Leave Salary</span>
            (Present + Paid Leave) × Daily Rate
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <span className="text-purple-600 dark:text-purple-400 block text-[10px] uppercase font-sans font-semibold mb-0.5">Week Off + Holiday Salary</span>
            (Week Off + Holiday) × Daily Rate
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <span className="text-amber-600 dark:text-amber-400 block text-[10px] uppercase font-sans font-semibold mb-0.5">Unpaid Deduction</span>
            Unpaid Working Days × Daily Rate
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 sm:col-span-2">
            <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase font-sans font-semibold mb-0.5">Total Payable</span>
            (Present + Paid Leave Salary) + (Week Off + Holiday Salary) − Unpaid Deduction
            <span className="block text-[10px] text-slate-500 font-sans mt-0.5">Equivalent to: Base Salary − Unpaid Deduction</span>
          </div>
        </div>
      </div>

      {/* ITEMIZED PAYROLL DETAIL MODAL */}
      {detailModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    Payroll Statement &middot; {detailModalUser.fullName}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {MONTH_NAMES[month - 1]} {year}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {detailModalUser.employeeId} &middot; {detailModalUser.teamName} &middot;{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {detailModalUser.employmentType}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPayslip}
                  disabled={downloadingPayslip || detailModalUser.baseSalary <= 0}
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition shadow-xs text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={detailModalUser.baseSalary <= 0 ? 'Salary not set for this employee' : 'Download official PDF payslip'}
                >
                  {downloadingPayslip ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>Download Payslip</span>
                </button>
                <button
                  onClick={() => setDetailModalUser(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Computation Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Monthly Base</span>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                  {detailModalUser.baseSalary > 0 ? `₹${detailModalUser.baseSalary.toLocaleString('en-IN')}` : 'Salary Not Set'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Daily Rate</span>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                  {detailModalUser.baseSalary > 0 ? `₹${detailModalUser.dailyRate.toFixed(2)}` : '-'}
                </p>
                <span className="text-[10px] text-slate-400">÷ {detailModalUser.calendarDays} calendar days</span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50">
                <span className="text-blue-500 text-[10px] uppercase font-semibold">Present + Paid Leave Salary</span>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                  {detailModalUser.baseSalary > 0
                    ? `₹${((detailModalUser.presentAndPaidLeaveSalary ?? ((detailModalUser.presentDays + detailModalUser.paidLeaveDays) * (detailModalUser.baseSalary / (detailModalUser.calendarDays || 30))))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '-'}
                </p>
                <span className="text-[10px] text-blue-500">{detailModalUser.presentDays} Present + {detailModalUser.paidLeaveDays} Paid</span>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50">
                <span className="text-purple-500 text-[10px] uppercase font-semibold">Week Off + Holiday Salary</span>
                <p className="text-sm font-bold text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                  {detailModalUser.baseSalary > 0
                    ? `₹${((detailModalUser.weekOffAndHolidaySalary ?? ((detailModalUser.weeklyOffs + detailModalUser.companyHolidays) * (detailModalUser.baseSalary / (detailModalUser.calendarDays || 30))))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '-'}
                </p>
                <span className="text-[10px] text-purple-500">{detailModalUser.weeklyOffs} Offs + {detailModalUser.companyHolidays} Holidays</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                <span className="text-amber-600 text-[10px] uppercase font-semibold">Unpaid Deduction</span>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300 font-mono mt-0.5">
                  -₹{detailModalUser.unpaidDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-amber-500">{detailModalUser.unpaidLeaveDays} Unpaid Days</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 col-span-2 sm:col-span-3">
                <span className="text-emerald-600 text-[10px] uppercase font-semibold">TOTAL PAYABLE</span>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  ₹{detailModalUser.finalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Day-by-Day Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Day-by-Day Audit Breakdown
                </h4>
                <span className="text-[11px] text-slate-400">
                  {detailModalUser.dayByDayBreakdown.length} Calendar Days
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 text-[10px] text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Calendar Status</th>
                      <th className="py-2 px-3">Attendance</th>
                      <th className="py-2 px-3">Leave</th>
                      <th className="py-2 px-3 text-right">Audit Deduction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {detailModalUser.dayByDayBreakdown.map((d) => (
                      <tr
                        key={d.dateKey}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                          d.isDeducted ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        <td className="py-1.5 px-3 font-mono text-[11px]">
                          {d.dateKey} ({d.dayName.slice(0, 3)})
                        </td>
                        <td className="py-1.5 px-3 text-[11px]">
                          {d.dayStatus === 'COMPANY_HOLIDAY' && (
                            <span className="text-purple-600 font-semibold">★ Holiday</span>
                          )}
                          {d.dayStatus === 'WEEKLY_OFF' && (
                            <span className="text-amber-600">Weekly Off (Wed)</span>
                          )}
                          {d.dayStatus === 'SPECIAL_WORKING_DAY' && (
                            <span className="text-emerald-600 font-semibold">⚡ Special Working Day</span>
                          )}
                          {d.dayStatus === 'OUT_OF_TENURE' && (
                            <span className="text-slate-400 italic">Out of Tenure</span>
                          )}
                          {d.dayStatus === 'WORKING_DAY' && (
                            <span className="text-slate-600 dark:text-slate-400">Working Day</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-[11px]">
                          {d.attendanceStatus === 'PRESENT' && (
                            <span className="text-emerald-600 font-semibold">Present</span>
                          )}
                          {d.attendanceStatus === 'HALF_DAY' && (
                            <span className="text-amber-600 font-semibold">Half Day (0.5)</span>
                          )}
                          {!d.attendanceStatus && d.dayStatus === 'WORKING_DAY' && (
                            <span className="text-slate-400 italic">No attendance</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-[11px]">
                          {d.leaveStatus ? (
                            <span
                              className={
                                d.leaveStatus === 'PAID'
                                  ? 'text-blue-600 font-semibold'
                                  : 'text-amber-600 font-semibold'
                              }
                            >
                              {d.leaveType} ({d.leaveStatus})
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-[11px]">
                          {d.isDeducted ? (
                            <span className="text-rose-600 font-semibold">
                              -{d.deductionUnits} day (-₹{(d.deductionUnits * (d.dayDailyRate || detailModalUser.dailyRate)).toFixed(2)})
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Covered</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleDownloadPayslip}
                disabled={downloadingPayslip || detailModalUser.baseSalary <= 0}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={detailModalUser.baseSalary <= 0 ? 'Salary not set for this employee' : 'Download official PDF payslip'}
              >
                {downloadingPayslip ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download Payslip</span>
              </button>
              <button
                onClick={() => setDetailModalUser(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SALARY MASTER DETAILS MODAL */}
      {salaryModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Payroll Master Details &middot; {salaryModalUser.fullName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {salaryModalUser.employeeId} &middot; {salaryModalUser.teamName}
                </p>
              </div>
              <button
                onClick={() => setSalaryModalUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSalary} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Monthly Base Salary (₹ INR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={100}
                  value={formSalary}
                  onChange={(e) => setFormSalary(Number(e.target.value))}
                  placeholder="e.g. 23000"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    Salary Effective From <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formEffectiveFrom}
                    onChange={(e) => setFormEffectiveFrom(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    Employment Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formEmploymentType}
                    onChange={(e) => setFormEmploymentType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="FULL_TIME">Full-Time</option>
                    <option value="INTERN">Intern</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    Joining Date <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formJoiningDate}
                    onChange={(e) => setFormJoiningDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    Leaving Date <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formExitDate}
                    onChange={(e) => setFormExitDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Revision Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Master configuration, annual appraisal revision..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSalaryModalUser(null)}
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
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FINALIZE MONTH CONFIRMATION MODAL */}
      {finalizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Finalize {MONTH_NAMES[month - 1]} {year} Payroll?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Confirm official monthly approval and locking.
                </p>
              </div>
              <button
                onClick={() => setFinalizeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                This will mark the current payroll calculation for <strong className="text-slate-900 dark:text-slate-100 font-semibold">{MONTH_NAMES[month - 1]} {year}</strong> as the official finalized payroll.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total Workforce:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{summary.totalEmployees} Active Employees</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total Net Disbursement:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">₹{summary.totalPayableSalary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Applicable Working Days:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{applicableWorkingDays} days</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                After finalization, any subsequent changes affecting this month (such as Work Calendar adjustments or leave approvals) will preserve recalculation protection and mark the month as requiring recalculation.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setFinalizeModalOpen(false)}
                disabled={actionLoading}
                className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmFinalizePayroll}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer text-xs"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Finalize Month
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
