import type { UserRole } from './auth';

export const PERMISSIONS: Record<UserRole, string[]> = {
  MANAGER: ['ALL'],
  TEAM_LEAD: ['TEAM_VIEW', 'TEAM_ATTENDANCE', 'LEAVE_APPROVE_L1', 'REPORTS_TEAM'],
  EMPLOYEE: ['SELF_ATTENDANCE', 'SELF_LEAVE', 'CALENDAR_VIEW'],
};

export function hasPermission(role: UserRole, requiredPermission: string): boolean {
  if (role === 'MANAGER') return true;
  const userPermissions = PERMISSIONS[role] || [];
  return userPermissions.includes(requiredPermission);
}