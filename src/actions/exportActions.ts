'use server';

import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { getSession } from '@/lib/auth';
import { getIndiaWorkdayInfo, getIndiaDateKey } from '@/lib/attendanceDate';


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
    'Joined Date': getIndiaDateKey(e.createdAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Workforce');
  const bookType = filters?.format === 'csv' ? 'csv' : 'xlsx';
  const base64 = XLSX.write(workbook, { type: 'base64', bookType });
  const ext = filters?.format === 'csv' ? 'csv' : 'xlsx';
  return { base64, fileName: 'Persevex_Workforce_' + getIndiaDateKey(new Date()) + '.' + ext };
}

export async function exportAttendanceReport(filters?: ReportFilters): Promise<{ base64: string; fileName: string }> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const india = getIndiaWorkdayInfo();
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
    if (filters.status === 'LATE' || filters.status === 'ON_TIME') {
      whereClause.lateStatus = filters.status;
    } else if (filters.status === 'ABSENT' || filters.status === 'HALF_DAY' || filters.status === 'PRESENT' || filters.status === 'ON_LEAVE') {
      whereClause.status = filters.status;
    }
  }

  if (filters?.datePreset) {
    if (filters.datePreset === 'TODAY') {
      whereClause.date = { gte: india.startOfDayIST, lte: india.endOfDayIST };
    } else if (filters.datePreset === 'YESTERDAY') {
      const start = new Date(Date.UTC(india.year, india.month - 1, india.day - 1, -5, -30, 0, 0));
      const end = new Date(Date.UTC(india.year, india.month - 1, india.day - 1, 18, 29, 59, 999));
      whereClause.date = { gte: start, lte: end };
    } else if (filters.datePreset === 'THIS_WEEK') {
      const start = new Date(Date.UTC(india.year, india.month - 1, india.day - 6, -5, -30, 0, 0));
      whereClause.date = { gte: start, lte: india.endOfDayIST };
    } else if (filters.datePreset === 'LAST_WEEK') {
      const start = new Date(Date.UTC(india.year, india.month - 1, india.day - 13, -5, -30, 0, 0));
      const end = new Date(Date.UTC(india.year, india.month - 1, india.day - 7, 18, 29, 59, 999));
      whereClause.date = { gte: start, lte: end };
    } else if (filters.datePreset === 'THIS_MONTH') {
      const start = new Date(Date.UTC(india.year, india.month - 1, 1, -5, -30, 0, 0));
      whereClause.date = { gte: start, lte: india.endOfDayIST };
    } else if (filters.datePreset === 'LAST_MONTH') {
      const start = new Date(Date.UTC(india.year, india.month - 2, 1, -5, -30, 0, 0));
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
    'Date': getIndiaDateKey(r.date),
    'Employee ID': r.user.employeeId,
    'Employee Name': r.user.fullName,
    'Team': r.user.team?.name || 'General',
    'Check-In': r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '--',
    'Check-Out': r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '--',
    'Working Hours': r.totalHours || 0,
    'Punctuality': r.lateStatus || '--',
    'Status': r.status,
  }));

  if (session.role === 'MANAGER' || session.role === 'TEAM_LEAD') {
    const isSingleDay = !filters?.datePreset || filters.datePreset === 'TODAY' || filters.datePreset === 'YESTERDAY' || (filters.datePreset === 'CUSTOM' && filters.customStart && filters.customStart === filters.customEnd);
    if (isSingleDay) {
      const canonicalStr = india.dateKey;
      const targetDateStr: string = filters?.datePreset === 'YESTERDAY' ? getIndiaDateKey(new Date(Date.now() - 86400000)) : (filters?.customStart ? String(filters.customStart) : canonicalStr);

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
  return { base64, fileName: 'Persevex_Attendance_' + getIndiaDateKey(new Date()) + '.' + ext };
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
    'From Date': getIndiaDateKey(l.startDate),
    'To Date': getIndiaDateKey(l.endDate),
    'Days': l.numberOfDays,
    'Reason': l.reason,
    'Status': l.currentStage,
    'Applied Date': getIndiaDateKey(l.createdAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leaves');
  const bookType = filters?.format === 'csv' ? 'csv' : 'xlsx';
  const base64 = XLSX.write(workbook, { type: 'base64', bookType });
  const ext = filters?.format === 'csv' ? 'csv' : 'xlsx';
  return { base64, fileName: 'Persevex_Leaves_' + getIndiaDateKey(new Date()) + '.' + ext };
}
