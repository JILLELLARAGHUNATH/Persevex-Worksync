'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

export default function RealtimeListener() {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const lastFocusRefreshRef = useRef<number>(0);

  // Snapshot tracking refs for direct Supabase deletion detection
  const prevTodayAttUserIdsRef = useRef<Set<string>>(new Set());
  const prevActiveAnnouncementIdsRef = useRef<Set<string>>(new Set());
  const prevActiveLeaveIdsRef = useRef<Set<string>>(new Set());
  const prevActiveNotificationIdsRef = useRef<Set<string>>(new Set());
  const isFirstSyncRef = useRef<boolean>(true);

  const handleIncomingEvent = (data: any) => {
    if (!data || !data.type || data.type === 'CONNECTED') return;

    // Deduplicate rapid duplicate events (1.5s window)
    const eventKey = `${data.type}-${JSON.stringify(data.payload || {})}`;
    if (processedEventIdsRef.current.has(eventKey)) {
      return;
    }
    processedEventIdsRef.current.add(eventKey);
    setTimeout(() => {
      processedEventIdsRef.current.delete(eventKey);
    }, 1500);

    // Broadcast across local window components (triggers immediate targeted state updates)
    window.dispatchEvent(new CustomEvent('persevex-realtime', { detail: data }));

    // Broadcast across other browser tabs via BroadcastChannel
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage(data);
      }
    } catch {}
  };

  useEffect(() => {
    if (lastSyncTimeRef.current === 0) {
      lastSyncTimeRef.current = Date.now() - 15000;
    }

    // 0. Setup Direct Supabase Realtime WebSocket Connection (Postgres Changes)
    let supabaseChannel: any = null;
    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        supabaseChannel = supabase
          .channel('persevex-realtime-db')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Attendance' },
            (payload: any) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                handleIncomingEvent({
                  type: 'ATTENDANCE_UPDATE',
                  payload: {
                    status: payload.new?.checkOutTime ? 'CHECKED_OUT' : 'CHECKED_IN',
                    attendance: payload.new,
                    userId: payload.new?.userId,
                  },
                  timestamp: Date.now(),
                });
              } else if (payload.eventType === 'DELETE') {
                handleIncomingEvent({
                  type: 'ATTENDANCE_UPDATE',
                  payload: {
                    status: 'ATTENDANCE_DELETED',
                    userId: payload.old?.userId,
                    attendanceId: payload.old?.id,
                    attendance: null,
                  },
                  timestamp: Date.now(),
                });
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'LeaveRequest' },
            (payload: any) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                handleIncomingEvent({
                  type: 'LEAVE_STATUS_CHANGED',
                  payload: {
                    leaveId: payload.new?.id,
                    stage: payload.new?.currentStage,
                    leave: payload.new,
                  },
                  timestamp: Date.now(),
                });
              } else if (payload.eventType === 'DELETE') {
                handleIncomingEvent({
                  type: 'LEAVE_STATUS_CHANGED',
                  payload: {
                    type: 'LEAVE_DELETED',
                    leaveId: payload.old?.id,
                    stage: 'DELETED',
                  },
                  timestamp: Date.now(),
                });
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Announcement' },
            (payload: any) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                handleIncomingEvent({
                  type: 'SYSTEM_ANNOUNCEMENT',
                  payload: {
                    type: 'ANNOUNCEMENT_CREATED',
                    announcement: payload.new,
                  },
                  timestamp: Date.now(),
                });
              } else if (payload.eventType === 'DELETE') {
                handleIncomingEvent({
                  type: 'SYSTEM_ANNOUNCEMENT',
                  payload: {
                    type: 'ANNOUNCEMENT_DELETED',
                    announcementId: payload.old?.id,
                  },
                  timestamp: Date.now(),
                });
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Notification' },
            (payload: any) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                handleIncomingEvent({
                  type: 'NOTIFICATION_RECEIVED',
                  payload: {
                    notification: payload.new,
                  },
                  timestamp: Date.now(),
                });
              } else if (payload.eventType === 'DELETE') {
                handleIncomingEvent({
                  type: 'NOTIFICATION_RECEIVED',
                  payload: {
                    type: 'NOTIFICATION_DELETED',
                    notificationId: payload.old?.id,
                  },
                  timestamp: Date.now(),
                });
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'User' },
            (payload: any) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                handleIncomingEvent({
                  type: 'WORKFORCE_UPDATE',
                  payload: {
                    action: payload.new?.isDeleted ? 'EMPLOYEE_DELETED' : 'EMPLOYEE_UPDATED',
                    user: payload.new,
                    userId: payload.new?.id,
                  },
                  timestamp: Date.now(),
                });
              }
            }
          )
          .subscribe();
      }
    } catch (err) {
      console.warn('Supabase Realtime subscription error:', err);
    }

    // 1. Setup BroadcastChannel for 0ms cross-tab synchronization
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('persevex-realtime-channel');
        broadcastChannelRef.current = channel;
        channel.onmessage = (event) => {
          if (event.data) {
            window.dispatchEvent(new CustomEvent('persevex-realtime', { detail: event.data }));
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    // Listen to local tab dispatches and mirror to other tabs
    const handleLocalDispatch = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.origin !== 'broadcast') {
        try {
          if (broadcastChannelRef.current) {
            broadcastChannelRef.current.postMessage({ ...detail, origin: 'broadcast' });
          }
        } catch {}
      }
    };
    window.addEventListener('persevex-realtime', handleLocalDispatch);

    // 2. Setup Server-Sent Events (SSE) for environments supporting long-lived streams
    let reconnectTimeout: any = null;
    let backoffDelay = 3000;

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        const eventSource = new EventSource('/api/realtime');
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          backoffDelay = 3000;
        };

        eventSource.onmessage = (event) => {
          try {
            if (!event.data || event.data.startsWith(':')) return;
            const data = JSON.parse(event.data);
            handleIncomingEvent(data);
          } catch (err) {
            console.error('Realtime SSE parse error:', err);
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, backoffDelay);
          backoffDelay = Math.min(backoffDelay * 1.5, 15000);
        };
      } catch (err) {
        console.warn('SSE connection init error:', err);
      }
    };

    // 3. Setup High-Performance Universal DB Sync Engine
    // Polls every 1.5s when active/visible, pauses when hidden, immediate on visibility/focus
    let syncTimeout: any = null;

    const runSyncCheck = async () => {
      if (isPollingRef.current || (typeof document !== 'undefined' && document.hidden)) return;
      isPollingRef.current = true;

      try {
        const url = `/api/realtime/sync?since=${lastSyncTimeRef.current}`;
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.serverTimestamp) {
            lastSyncTimeRef.current = data.serverTimestamp - 1000;
          }

          // Process incremental delta events
          if (data.hasChanges && Array.isArray(data.events) && data.events.length > 0) {
            for (const ev of data.events) {
              handleIncomingEvent(ev);
            }
          }

          // Direct Supabase Deletion & Snapshot Reconciliation
          if (data.snapshot) {
            const currentAttUserIds = new Set<string>(data.snapshot.todayAttendanceUserIds || []);
            const currentAnnouncementIds = new Set<string>(data.snapshot.activeAnnouncementIds || []);
            const currentLeaveIds = new Set<string>(data.snapshot.activeLeaveIds || []);
            const currentNotificationIds = new Set<string>(data.snapshot.activeNotificationIds || []);

            if (!isFirstSyncRef.current) {
              // Detect deleted attendances for today
              for (const prevUserId of prevTodayAttUserIdsRef.current) {
                if (!currentAttUserIds.has(prevUserId)) {
                  handleIncomingEvent({
                    type: 'ATTENDANCE_UPDATE',
                    payload: {
                      status: 'ATTENDANCE_DELETED',
                      userId: prevUserId,
                      attendance: null,
                    },
                  });
                }
              }

              // Detect deleted announcements
              for (const prevAnnId of prevActiveAnnouncementIdsRef.current) {
                if (!currentAnnouncementIds.has(prevAnnId)) {
                  handleIncomingEvent({
                    type: 'SYSTEM_ANNOUNCEMENT',
                    payload: {
                      type: 'ANNOUNCEMENT_DELETED',
                      announcementId: prevAnnId,
                    },
                  });
                }
              }

              // Detect deleted leaves
              for (const prevLeaveId of prevActiveLeaveIdsRef.current) {
                if (!currentLeaveIds.has(prevLeaveId)) {
                  handleIncomingEvent({
                    type: 'LEAVE_STATUS_CHANGED',
                    payload: {
                      type: 'LEAVE_DELETED',
                      leaveId: prevLeaveId,
                      stage: 'DELETED',
                    },
                  });
                }
              }

              // Detect deleted notifications
              for (const prevNotifId of prevActiveNotificationIdsRef.current) {
                if (!currentNotificationIds.has(prevNotifId)) {
                  handleIncomingEvent({
                    type: 'NOTIFICATION_RECEIVED',
                    payload: {
                      type: 'NOTIFICATION_DELETED',
                      notificationId: prevNotifId,
                    },
                  });
                }
              }
            }

            prevTodayAttUserIdsRef.current = currentAttUserIds;
            prevActiveAnnouncementIdsRef.current = currentAnnouncementIds;
            prevActiveLeaveIdsRef.current = currentLeaveIds;
            prevActiveNotificationIdsRef.current = currentNotificationIds;
            isFirstSyncRef.current = false;

            // Broadcast snapshot sync to components
            window.dispatchEvent(
              new CustomEvent('persevex-realtime', {
                detail: {
                  type: 'SNAPSHOT_SYNC',
                  snapshot: data.snapshot,
                },
              })
            );
          }
        }
      } catch {
        // Silently swallow network jitter
      } finally {
        isPollingRef.current = false;
      }
    };

    const scheduleNextSync = (immediate = false) => {
      clearTimeout(syncTimeout);
      if (typeof document !== 'undefined' && document.hidden) return;

      if (immediate) {
        runSyncCheck().finally(() => {
          scheduleNextSync(false);
        });
        return;
      }

      // Fast, ultra-lightweight 1.5s active sync interval
      syncTimeout = setTimeout(async () => {
        await runSyncCheck();
        scheduleNextSync(false);
      }, 1500);
    };

    connectSSE();
    scheduleNextSync(true);

    // Run sync check and debounced server revalidation when tab regains focus or visibility
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        scheduleNextSync(true);

        const now = Date.now();
        // Debounce server component revalidation to at most once every 15 seconds
        if (now - lastFocusRefreshRef.current > 15000) {
          lastFocusRefreshRef.current = now;
          router.refresh();
        }
      }
    };

    window.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);

    return () => {
      clearTimeout(reconnectTimeout);
      clearTimeout(syncTimeout);
      window.removeEventListener('persevex-realtime', handleLocalDispatch);
      window.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);

      if (supabaseChannel) {
        try {
          const supabase = getSupabaseBrowserClient();
          supabase?.removeChannel(supabaseChannel);
        } catch {}
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [router]);

  return null;
}


