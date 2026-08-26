import { EventEmitter } from 'events';

class AppEventEmitter extends EventEmitter {}

const globalForEvents = globalThis as unknown as { appEvents: AppEventEmitter | undefined };

export const appEvents = globalForEvents.appEvents ?? new AppEventEmitter();
appEvents.setMaxListeners(300);

if (process.env.NODE_ENV !== 'production') globalForEvents.appEvents = appEvents;

export const EVENT_TYPES = {
  ATTENDANCE_UPDATE: 'ATTENDANCE_UPDATE',
  LEAVE_STATUS_CHANGED: 'LEAVE_STATUS_CHANGED',
  NOTIFICATION_RECEIVED: 'NOTIFICATION_RECEIVED',
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
  TASK_UPDATE: 'TASK_UPDATE',
  WORKFORCE_UPDATE: 'WORKFORCE_UPDATE',
  ORGANIZATION_UPDATE: 'ORGANIZATION_UPDATE',
};