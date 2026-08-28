'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function RealtimeListener() {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now() - 10000);
  const sseActiveRef = useRef<boolean>(false);
  const isPollingRef = useRef<boolean>(false);
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const handleIncomingEvent = (data: any) => {
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

    // Broadcast across local window components (triggers silent state updates for attendance tables, counts, dashboards, and bell badge)
    window.dispatchEvent(new CustomEvent('persevex-realtime', { detail: data }));

    // Broadcast across other browser tabs
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage(data);
      }
    } catch {}

    // Refresh Server Components tree in background silently
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
            handleIncomingEvent(data);
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
              handleIncomingEvent(ev);
            }
          }
        }
      } catch (err) {
        // Silently swallow network jitter
      } finally {
        isPollingRef.current = false;
      }
    };

    // Run sync check periodically only if SSE is disconnected
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
