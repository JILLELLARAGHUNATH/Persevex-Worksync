'use server';

import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { getSession } from '@/lib/auth';
import { getIndiaWorkdayInfo } from '@/lib/attendanceDate';


export interface ReportFilters {
  datePreset?: string;
  customStart?: string;
  customEnd?: string;
  teamId?: string;
  employeeId?: string;
  status?: string;
  format?: 'xlsx' | 'csv';
}

export async function exportWorkforceReport(filters?: ReportFilters): Promise<{ base64: string; fileName: string }> {
  const session = await getSession();
  if (!session || (session.role !== 'MANAGER' && session.role !== 'TEAM_LEAD')) {
    throw new Error('Unauthorized');
  }

  const whereClause: any = { isDeleted: false };
  if (session.role === 'TEAM_LEAD') {
    whereClause.teamId = session.teamId;
  } else if (filters?.teamId) {
    whereClause.teamId = filters.teamId;
  }

  const employees = await prisma.user.findMany({
    where: whereClause,
    include: { team: true },
    orderBy: { fullName: 'asc' },
  });

  const data = employees.map((e) => ({
    'Employee ID': e.employeeId,
    'Full Name': e.fullName,
    'Email': e.email,
    'Phone': e.phone || '—',
    'Role': e.role,
    'Team': e.team?.name || 'Unassigned',
    'Status': e.accountStatus,
    'Joined Date': e.createdAt.toISOString().split('T')[0],
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Workforce');
  const bookType = filters?.format === 'csv' ? 'csv' : 'xlsx';
  const base64 = XLSX.write(workbook, { type: 'base64', bookType });
  const ext = filters?.format === 'csv' ? 'csv' : 'xlsx';
  return { base64, fileName: 'Persevex_Workforce_' + new Date().toISOString().split('T')[0] + '.' + ext };
}

export async function exportAttendanceReport(filters?: ReportFilters): Promise<{ base64: string; fileName: string }> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const whereClause: any = {};
  if (session.role === 'TEAM_LEAD') {
    whereClause.user = { teamId: session.teamId, role: { not: 'MANAGER' } };
  } else if (session.role === 'EMPLOYEE') {
    whereClause.userId = session.id;
  } else {
    whereClause.user = { role: { not: 'MANAGER' } };
    if (filters?.teamId) whereClause.user.teamId = filters.teamId;
    if (filters?.employeeId) {
      delete whereClause.user;
      whereClause.userId = filters.employeeId;
    }
  }


  if (filters?.status) {
    if (filters.status === 'PRESENT') {
      whereClause.status = 'PRESENT';
    } else if (filters.status === 'LATE') {
      whereClause.status = 'PRESENT';
      whereClause.lateStatus = 'LATE';
    } else if (filters.status === 'ON_TIME') {
      whereClause.status = 'PRESENT';
      whereClause.lateStatus = 'ON_TIME';
    } else {
      whereClause.status = filters.status;
    }
  }

  if (filters?.datePreset) {
    const india = getIndiaWorkdayInfo();
    const now = new Date();
    if (filters.datePreset === 'TODAY') {
      whereClause.date = { gte: india.startOfDayIST, lte: india.endOfDayIST };
    } else if (filters.datePreset === 'THIS_WEEK') {
      const start = new Date(india.startOfDayIST.getTime() - 6 * 24 * 60 * 60 * 1000);
      whereClause.date = { gte: start, lte: india.endOfDayIST };
    } else if (filters.datePreset === 'LAST_WEEK') {
      const start = new Date(india.startOfDayIST.getTime() - 13 * 24 * 60 * 60 * 1000);
      const end = new Date(india.startOfDayIST.getTime() - 7 * 24 * 60 * 60 * 1000);
      whereClause.date = { gte: start, lte: end };
    } else if (filters.datePreset === 'THIS_MONTH') {
      const start = new Date(Date.UTC(india.year, india.month - 1, 1, -5, -30, 0, 0));
      whereClause.date = { gte: start, lte: india.endOfDayIST };
    } else if (filters.datePreset === 'LAST_MONTH') {
      const prevMonthYear = india.month === 1 ? india.year - 1 : india.year;
      const prevMonth = india.month === 1 ? 12 : india.month - 1;
      const start = new Date(Date.UTC(prevMonthYear, prevMonth - 1, 1, -5, -30, 0, 0));
      const end = new Date(Date.UTC(india.year, india.month - 1, 0, 18, 29, 59, 999));
      whereClause.date = { gte: start, lte: end };
    } else if (filters.datePreset === 'CUSTOM' && (filters.customStart || filters.customEnd)) {
      whereClause.date = {};
      if (filters.customStart) {
        whereClause.date.gte = new Date(filters.customStart);
      }
      if (filters.customEnd) {
        const end = new Date(filters.customEnd);
        end.setHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    }
  }

  const records = await prisma.attendance.findMany({
    where: whereClause,
    include: { user: { include: { team: true } } },
    orderBy: { date: 'desc' },
  });

  let data = records.map((r) => ({
    'Date': r.date.toISOString().split('T')[0],
    'Employee ID': r.user.employeeId,
    'Employee Name': r.user.fullName,
    'Team': r.user.team?.name || 'General',
    'Check-In': r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '--',
    'Check-Out': r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '--',
    'Working Hours': r.totalHours || 0,
    'Punctuality': r.lateStatus || '--',
    'Status': r.status,
  }));

  // If exporting single day (TODAY, YESTERDAY, or ALL/ABSENT filter), synthesize missing active employees
  if (session.role === 'MANAGER' || session.role === 'TEAM_LEAD') {
    const isSingleDay = !filters?.datePreset || filters.datePreset === 'TODAY' || filters.datePreset === 'YESTERDAY' || (filters.datePreset === 'CUSTOM' && filters.customStart && filters.customStart === filters.customEnd);
    if (isSingleDay) {
      const india = getIndiaWorkdayInfo();
      const canonicalStr = typeof india.canonicalDate === 'string' ? india.canonicalDate : new Date(india.canonicalDate).toISOString().split('T')[0];
      const targetDateStr: string = filters?.datePreset === 'YESTERDAY' ? new Date(Date.now() - 86400000).toISOString().split('T')[0] : (filters?.customStart ? String(filters.customStart) : canonicalStr);

      const empWhere: any = { isDeleted: false, accountStatus: { not: 'SUSPENDED' }, role: { not: 'MANAGER' } };
      if (session.role === 'TEAM_LEAD') {
        empWhere.teamId = session.teamId;
      } else if (filters?.teamId) {
        empWhere.teamId = filters.teamId;
      }
      if (filters?.employeeId) {
        empWhere.id = filters.employeeId;
      }

      const activeEmployees = await prisma.user.findMany({
        where: empWhere,
        include: { team: true },
        orderBy: { fullName: 'asc' },
      });

      const recordedUserIds = new Set(records.map((r) => r.userId));

      const missingEmployees = activeEmployees.filter((e) => !recordedUserIds.has(e.id));
      const logicalAbsentRows = missingEmployees.map((e) => ({
        'Date': targetDateStr,
        'Employee ID': e.employeeId,
        'Employee Name': e.fullName,
        'Team': e.team?.name || 'General',
        'Check-In': '--',
        'Check-Out': '--',
        'Working Hours': 0,
        'Punctuality': '--',
        'Status': 'ABSENT',
      }));

      if (filters?.status === 'ABSENT') {
        data = [...data.filter((d) => d.Status === 'ABSENT'), ...logicalAbsentRows];
      } else if (!filters?.status) {
        data = [...data, ...logicalAbsentRows];
      }
    }
  }


  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  const bookType = filters?.format === 'csv' ? 'csv' : 'xlsx';
  const base64 = XLSX.write(workbook, { type: 'base64', bookType });
  const ext = filters?.format === 'csv' ? 'csv' : 'xlsx';
  return { base64, fileName: 'Persevex_Attendance_' + new Date().toISOString().split('T')[0] + '.' + ext };
}

export async function exportLeaveReport(filters?: ReportFilters): Promise<{ base64: string; fileName: string }> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const whereClause: any = {};
  if (session.role === 'TEAM_LEAD') {
    whereClause.user = { teamId: session.teamId };
  } else if (session.role === 'EMPLOYEE') {
    whereClause.userId = session.id;
  } else {
    if (filters?.teamId) {
      whereClause.user = { teamId: filters.teamId };
    }
    if (filters?.employeeId) {
      whereClause.userId = filters.employeeId;
    }
  }

  if (filters?.status) {
    whereClause.currentStage = filters.status;
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: { user: { include: { team: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const data = leaves.map((l) => ({
    'Employee ID': l.user.employeeId,
    'Employee Name': l.user.fullName,
    'Team': l.user.team?.name || 'General',
    'Leave Type': l.leaveType,
    'From Date': l.startDate.toISOString().split('T')[0],
    'To Date': l.endDate.toISOString().split('T')[0],
    'Days': l.numberOfDays,
    'Reason': l.reason,
    'Status': l.currentStage,
    'Applied Date': l.createdAt.toISOString().split('T')[0],
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leaves');
  const bookType = filters?.format === 'csv' ? 'csv' : 'xlsx';
  const base64 = XLSX.write(workbook, { type: 'base64', bookType });
  const ext = filters?.format === 'csv' ? 'csv' : 'xlsx';
  return { base64, fileName: 'Persevex_Leaves_' + new Date().toISOString().split('T')[0] + '.' + ext };
}
