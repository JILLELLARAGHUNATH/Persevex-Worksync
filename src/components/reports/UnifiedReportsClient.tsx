'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { exportAttendanceReport, exportWorkforceReport, exportLeaveReport, ReportFilters } from '@/actions/exportActions';
import { toast } from 'sonner';

export default function UnifiedReportsClient({
  role,
  teams = [],
  employees = [],
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6 transition-colors">
      <div className="space-y-4">
        <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Select Report Parameters</h3>

        {role !== 'EMPLOYEE' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Report Category</label>
            <div className="flex gap-2">
              <button
                onClick={() => setReportType('ATTENDANCE')}
                className={'px-4 py-2 rounded-xl text-xs font-bold transition ' + (reportType === 'ATTENDANCE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300')}
              >
                Attendance Ledger
              </button>
              {role === 'MANAGER' && (
                <button
                  onClick={() => setReportType('EMPLOYEE')}
                  className={'px-4 py-2 rounded-xl text-xs font-bold transition ' + (reportType === 'EMPLOYEE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300')}
                >
                  Workforce Roster
                </button>
              )}
              <button
                onClick={() => setReportType('LEAVE')}
                className={'px-4 py-2 rounded-xl text-xs font-bold transition ' + (reportType === 'LEAVE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300')}
              >
                Leave Utilization
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Date Range Preset</label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium"
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
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">From Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">To Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </>
          )}

          {role === 'MANAGER' && (
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Team Scope</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium"
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium"
              >
                <option value="">All Employees</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName} ({e.employeeId})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Attendance Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium"
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

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
        <button
          onClick={() => handleExport('csv')}
          disabled={loading}
          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-slate-500" />}
          Download CSV (.csv)
        </button>

        <button
          onClick={() => handleExport('xlsx')}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition shadow-md shadow-emerald-600/20"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          Export Excel (.xlsx)
        </button>
      </div>
    </div>
  );
}
