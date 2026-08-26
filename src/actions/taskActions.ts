'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { appEvents, EVENT_TYPES } from '@/lib/events';

export async function updateTaskStatusAction(
  taskId: string,
  newStatus: string,
  workNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized: Please log in.' };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  });

  if (!task) return { success: false, error: 'Task not found.' };

  // Authorization check: User must be Manager, the task creator, or the assignee
  if (session.role !== 'MANAGER' && task.assignedById !== session.id && task.assignedToId !== session.id) {
    return { success: false, error: 'Unauthorized to modify this task.' };
  }

  const isCompleted = newStatus === 'COMPLETED';
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: newStatus,
      ...(workNotes && { workNotes }),
      completedDate: isCompleted ? new Date() : null,
    },
    include: { assignedTo: true, assignedBy: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      role: session.role,
      action: 'TASK_STATUS_CHANGED',
      target: `Task#${task.taskCode}`,
      details: `${session.fullName} transitioned task to ${newStatus}`,
    },
  });

  if (task.assignedById && task.assignedById !== session.id) {
    await prisma.notification.create({
      data: {
        userId: task.assignedById,
        title: `Task Updated: ${task.taskCode}`,
        message: `${session.fullName} updated status to ${newStatus.replace(/_/g, ' ')}`,
        type: 'TASK',
      },
    });
  }

  appEvents.emit(EVENT_TYPES.TASK_UPDATE, { action: 'UPDATED', task: updated });

  revalidatePath('/employee');
  revalidatePath('/team-lead');
  revalidatePath('/manager');
  return { success: true };
}

export async function createSquadTaskAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== 'TEAM_LEAD' && session.role !== 'MANAGER')) {
    return { success: false, error: 'Unauthorized: Only Managers and Team Leads can assign tasks.' };
  }

  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;
  const priority = (formData.get('priority') as string) || 'MEDIUM';
  const assignedToId = (formData.get('assignedToId') as string) || null;
  const dueDateStr = formData.get('dueDate') as string;
  const dueDate = dueDateStr ? new Date(dueDateStr) : null;

  if (!title) return { success: false, error: 'Task Title is required.' };

  const taskCount = await prisma.task.count();
  const taskCode = `TSK-${String(taskCount + 101).padStart(3, '0')}`;

  const assignee = assignedToId ? await prisma.user.findUnique({ where: { id: assignedToId } }) : null;

  const newTask = await prisma.task.create({
    data: {
      taskCode,
      title,
      description,
      priority,
      status: 'TO_DO',
      assignedToId,
      assignedById: session.id,
      teamId: assignee?.teamId || session.teamId || null,
      dueDate,
    },
    include: { assignedTo: true, assignedBy: true },
  });

  if (assignedToId) {
    await prisma.notification.create({
      data: {
        userId: assignedToId,
        title: `New Task Assigned: ${taskCode}`,
        message: `${session.fullName} assigned you: "${title}" (Priority: ${priority})`,
        type: 'TASK',
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      role: session.role,
      action: 'TASK_CREATED',
      target: `Task#${taskCode}`,
      details: `Created task "${title}" assigned to ${assignee?.fullName || 'Unassigned'}`,
    },
  });

  appEvents.emit(EVENT_TYPES.TASK_UPDATE, { action: 'CREATED', task: newTask });

  revalidatePath('/team-lead');
  revalidatePath('/manager');
  revalidatePath('/employee');
  return { success: true };
}
