'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { exportAttendanceReport, exportWorkforceReport, exportLeaveReport, ReportFilters } from '@/actions/exportActions';
import { toast } from 'sonner';

const EMPTY_ARRAY: any[] = [];

export default function UnifiedReportsClient({
  role,
  teams = EMPTY_ARRAY,
  employees = EMPTY_ARRAY,
}: {
  role: 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';
  teams?: any[];
  employees?: any[];
}) {
  const [reportType, setReportType] = useState<'ATTENDANCE' | 'EMPLOYEE' | 'LEAVE'>('ATTENDANCE');
  const [datePreset, setDatePreset] = useState<string>('THIS_MONTH');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const downloadFile = (base64: string, fileName: string, mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setLoading(true);
    try {
      let res: any = null;
      const filters: ReportFilters = {
        datePreset,
        customStart,
        customEnd,
        teamId: selectedTeam,
        employeeId: selectedEmployee,
        status: statusFilter,
        format,
      };

      if (reportType === 'ATTENDANCE') {
        res = await exportAttendanceReport(filters);
      } else if (reportType === 'EMPLOYEE') {
        res = await exportWorkforceReport(filters);
      } else {
        res = await exportLeaveReport(filters);
      }

      if (res && res.base64) {
        const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        downloadFile(res.base64, res.fileName, mime);
        toast.success('Report downloaded successfully!');
      } else {
        toast.error('No data found for this report filter.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-xl shadow-xs space-y-5 transition-colors">
      <div className="space-y-4">
        <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Select Report Parameters</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure filters and format for data export</p>
        </div>

        {role !== 'EMPLOYEE' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Report Category</label>
            <div className="inline-flex gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setReportType('ATTENDANCE')}
                className={'px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ' + (reportType === 'ATTENDANCE' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200')}
              >
                Attendance Ledger
              </button>
              {role === 'MANAGER' && (
                <button
                  onClick={() => setReportType('EMPLOYEE')}
                  className={'px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ' + (reportType === 'EMPLOYEE' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200')}
                >
                  Workforce Roster
                </button>
              )}
              <button
                onClick={() => setReportType('LEAVE')}
                className={'px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ' + (reportType === 'LEAVE' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200')}
              >
                Leave Utilization
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Date Range Preset</label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="LAST_WEEK">Last Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="ALL">All Time</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>

          {datePreset === 'CUSTOM' && (
            <>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">From Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">To Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          {role === 'MANAGER' && (
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Team Scope</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {role !== 'EMPLOYEE' && (
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Employees</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName} ({e.employeeId})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Attendance Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ON_TIME">On Time</option>
              <option value="LATE">Late</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
        <button
          onClick={() => handleExport('csv')}
          disabled={loading}
          className="h-8 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium px-3 rounded-lg text-xs flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-slate-500" />}
          Download CSV
        </button>

        <button
          onClick={() => handleExport('xlsx')}
          disabled={loading}
          className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
          Export Excel (.xlsx)
        </button>
      </div>
    </div>
  );
}
