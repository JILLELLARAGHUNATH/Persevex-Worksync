'use server';

import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { getSession } from '@/lib/auth';

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
    'Phone': e.phone || '�',
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
    whereClause.user = { teamId: session.teamId };
  } else if (session.role === 'EMPLOYEE') {
    whereClause.userId = session.id;
  } else {
    if (filters?.teamId) whereClause.user = { teamId: filters.teamId };
    if (filters?.employeeId) whereClause.userId = filters.employeeId;
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
    const now = new Date();
    if (filters.datePreset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      whereClause.date = { gte: start, lte: end };
    } else if (filters.datePreset === 'THIS_WEEK') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      whereClause.date = { gte: start, lte: now };
    } else if (filters.datePreset === 'LAST_WEEK') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 23, 59, 59, 999);
      whereClause.date = { gte: start, lte: end };
    } else if (filters.datePreset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      whereClause.date = { gte: start, lte: now };
    } else if (filters.datePreset === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
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

  const data = records.map((r) => ({
    'Date': r.date.toISOString().split('T')[0],
    'Employee ID': r.user.employeeId,
    'Employee Name': r.user.fullName,
    'Team': r.user.team?.name || 'General',
    'Check-In': r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '--',
    'Check-Out': r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '--',
    'Working Hours': r.totalHours,
    'Punctuality': r.lateStatus,
    'Status': r.status,
  }));

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
