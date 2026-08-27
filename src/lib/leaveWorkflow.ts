import type { UserSession } from '@/lib/auth';


export function nextStageAfterApprove(stage: string, role?: string) {
  if (role === 'MANAGER') return 'APPROVED';
  switch (stage) {
    case 'PENDING_TL':
      return 'PENDING_MANAGER';
    case 'PENDING_MANAGER':
      return 'APPROVED';
    default:
      return stage;
  }
}

export function canActOnLeave(session: UserSession, leave: any): boolean {
  const stage = leave.currentStage;
  if (stage === 'APPROVED' || stage === 'REJECTED') return false;

  const role = session.role;
  if (role === 'MANAGER') return true;

  if (role === 'TEAM_LEAD') {
    return stage === 'PENDING_TL';
  }

  return false;
}