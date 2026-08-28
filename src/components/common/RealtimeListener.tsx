'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function RealtimeListener() {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now() - 10000);
  const sseActiveRef = useRef<boolean>(false);
  const isPollingRef = useRef<boolean>(false);
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {}
  };

  const handleIncomingEvent = (data: any, isFromSync = false) => {
    if (!data || !data.type || data.type === 'CONNECTED') return;

    // Deduplicate rapid duplicate events
    const eventKey = `${data.type}-${JSON.stringify(data.payload || {})}`;
    if (processedEventIdsRef.current.has(eventKey)) {
      return;
    }
    processedEventIdsRef.current.add(eventKey);
    setTimeout(() => {
      processedEventIdsRef.current.delete(eventKey);
    }, 8000);

    // Play chime only for major system broadcasts and urgent notifications
    if (
      data.type === 'ANNOUNCEMENT_CREATED' ||
      data.type === 'SYSTEM_ANNOUNCEMENT' ||
      data.type === 'NOTIFICATION_RECEIVED'
    ) {
      playChime();
    }

    // Broadcast across local window components (triggers silent state updates for attendance tables, counts, dashboards)
    window.dispatchEvent(new CustomEvent('persevex-realtime', { detail: data }));

    // Broadcast across other browser tabs
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage(data);
      }
    } catch {}

    // Show notifications ONLY for relevant non-attendance system events
    // (Attendance updates are applied silently to dashboards, counts, and tables to prevent notification spam)
    if (isFromSync || data.origin !== 'local') {
      if (data.type === 'WORKFORCE_UPDATE') {
        if (data.payload?.action === 'EMPLOYEE_CREATED') {
          toast.success('Workforce Updated', { description: `New employee ${data.payload?.user?.fullName || ''} added.` });
        } else if (data.payload?.action === 'EMPLOYEE_UPDATED') {
          toast.info('Workforce Updated', { description: `${data.payload?.user?.fullName || 'Employee'} profile was updated.` });
        } else if (data.payload?.action === 'EMPLOYEE_DELETED') {
          toast.info('Workforce Updated', { description: 'An employee record was archived.' });
        }
      } else if (data.type === 'LEAVE_STATUS_CHANGED') {
        toast.info('Leave Status Updated', { description: 'A leave request status was updated.' });
      } else if (data.type === 'SYSTEM_ANNOUNCEMENT') {
        toast.info('New Announcement', { description: data.payload?.announcement?.title || 'A new announcement was published.' });
      }
    }

    // Refresh Server Components tree in background
    router.refresh();
  };

  useEffect(() => {
    // 1. Setup BroadcastChannel for 0ms cross-tab synchronization
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('persevex-realtime-channel');
        broadcastChannelRef.current = channel;
        channel.onmessage = (event) => {
          if (event.data) {
            window.dispatchEvent(new CustomEvent('persevex-realtime', { detail: event.data }));
            router.refresh();
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

    // 2. Setup Server-Sent Events (SSE)
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
          sseActiveRef.current = true;
          backoffDelay = 3000;
        };

        eventSource.onmessage = (event) => {
          try {
            if (!event.data || event.data.startsWith(':')) return;
            const data = JSON.parse(event.data);
            handleIncomingEvent(data, false);
          } catch (err) {
            console.error('Realtime SSE parse error:', err);
          }
        };

        eventSource.onerror = () => {
          sseActiveRef.current = false;
          eventSource.close();
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, backoffDelay);
          backoffDelay = Math.min(backoffDelay * 1.5, 15000);
        };
      } catch (err) {
        sseActiveRef.current = false;
        console.warn('SSE connection init error:', err);
      }
    };

    connectSSE();

    // 3. Setup Universal DB Sync Engine (Fallback for Serverless + Tab Focus)
    const runSyncCheck = async () => {
      if (isPollingRef.current || document.hidden) return;
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

          if (data.hasChanges && Array.isArray(data.events) && data.events.length > 0) {
            for (const ev of data.events) {
              handleIncomingEvent(ev, true);
            }
          }
        }
      } catch (err) {
        // Silently swallow network jitter
      } finally {
        isPollingRef.current = false;
      }
    };

    // Run sync check periodically only if SSE is disconnected or as an occasional heartbeat
    const syncInterval = setInterval(() => {
      if (!sseActiveRef.current) {
        runSyncCheck();
      }
    }, 4000);

    // Run sync check immediately when tab regains focus or visibility
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSyncCheck();
        router.refresh();
      }
    };
    const onWindowFocus = () => {
      runSyncCheck();
      router.refresh();
    };

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    return () => {
      clearTimeout(reconnectTimeout);
      clearInterval(syncInterval);
      window.removeEventListener('persevex-realtime', handleLocalDispatch);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);

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
