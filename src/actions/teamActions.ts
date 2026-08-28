'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { appEvents, EVENT_TYPES } from '@/lib/events';

export async function createTeamAction(name: string, code: string, teamLeadId?: string | null): Promise<{ success: boolean; error?: string; data?: any }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') return { success: false, error: 'Unauthorized' };

  if (!name.trim() || !code.trim()) return { success: false, error: 'Team name and code are required.' };

  const existing = await prisma.team.findFirst({
    where: { OR: [{ name: name.trim() }, { code: code.trim().toUpperCase() }] },
  });
  if (existing) return { success: false, error: 'A team with this name or code already exists.' };

  const team = await prisma.team.create({
    data: {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      teamLeadId: teamLeadId || null,
    },
    include: { teamLead: true, members: true },
  });

  if (teamLeadId) {
    await prisma.user.update({
      where: { id: teamLeadId },
      data: { role: 'TEAM_LEAD', teamId: team.id },
    });
  }

  appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, { action: 'TEAM_CREATED', teamId: team.id, team });
  revalidatePath('/manager/teams');
  revalidatePath('/manager/employees');
  return { success: true, data: team };
}

export async function updateTeamAction(id: string, name: string, teamLeadId?: string | null): Promise<{ success: boolean; error?: string; data?: any }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') return { success: false, error: 'Unauthorized' };

  const updatedTeam = await prisma.team.update({
    where: { id },
    data: {
      name: name.trim(),
      teamLeadId: teamLeadId || null,
    },
    include: { teamLead: true, members: true },
  });

  if (teamLeadId) {
    await prisma.user.update({
      where: { id: teamLeadId },
      data: { role: 'TEAM_LEAD', teamId: id },
    });
  }

  appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, { action: 'TEAM_UPDATED', teamId: id, team: updatedTeam });
  revalidatePath('/manager/teams');
  revalidatePath('/manager/employees');
  return { success: true, data: updatedTeam };
}

export async function deleteTeamAction(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') return { success: false, error: 'Unauthorized' };

  try {
    // Unassign members safely without deleting users
    await prisma.user.updateMany({
      where: { teamId: id },
      data: { teamId: null },
    });

    await prisma.team.delete({ where: { id } });

    appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, { action: 'TEAM_DELETED', teamId: id });
    revalidatePath('/manager/teams');
    revalidatePath('/manager/employees');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete team' };
  }
}

export async function moveMemberTeamAction(userId: string, newTeamId: string | null): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') return { success: false, error: 'Unauthorized' };

  await prisma.user.update({
    where: { id: userId },
    data: { teamId: newTeamId },
  });

  appEvents.emit(EVENT_TYPES.WORKFORCE_UPDATE, { action: 'MEMBER_MOVED', userId });
  revalidatePath('/manager/teams');
  revalidatePath('/manager/employees');
  return { success: true };
}
