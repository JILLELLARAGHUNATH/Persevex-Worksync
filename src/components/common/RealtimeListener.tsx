'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function RealtimeListener() {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);

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

  useEffect(() => {
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource('/api/realtime');
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.startsWith(':')) return;
          const data = JSON.parse(event.data);
          if (data.type === 'CONNECTED') return;

          // Play chime only for key alerts
          if (
            data.type === 'ANNOUNCEMENT_CREATED' ||
            data.type === 'SYSTEM_ANNOUNCEMENT' ||
            data.type === 'NOTIFICATION_RECEIVED' ||
            (data.type === 'ATTENDANCE_UPDATE' && data.payload?.status === 'CHECKED_IN')
          ) {
            playChime();
          }

          // Dispatch custom event so all active client-side components update their memory/UI immediately
          window.dispatchEvent(new CustomEvent('persevex-realtime', { detail: data }));

          // Show lightweight toast notifications
          if (data.type === 'ATTENDANCE_UPDATE') {
            if (data.payload?.status === 'CHECKED_IN') {
              const name = data.payload?.attendance?.user?.fullName || 'A team member';
              toast.success('Live Check-In', { description: `${name} has clocked in on duty.` });
            } else if (data.payload?.status === 'CHECKED_OUT') {
              const name = data.payload?.attendance?.user?.fullName || 'A team member';
              toast.info('Live Check-Out', { description: `${name} has clocked out.` });
            }
          } else if (data.type === 'WORKFORCE_UPDATE') {
            if (data.payload?.action === 'EMPLOYEE_CREATED') {
              toast.success('Workforce Updated', { description: `New employee ${data.payload?.user?.fullName || ''} added.` });
            } else if (data.payload?.action === 'EMPLOYEE_DELETED') {
              toast.info('Workforce Updated', { description: 'An employee record was archived.' });
            }
          } else if (data.type === 'LEAVE_STATUS_CHANGED') {
            toast.info('Leave Status Updated', { description: 'A leave request status was updated.' });
          }

          // Always trigger router.refresh() to keep Server Component trees in sync with DB
          router.refresh();
        } catch (err) {
          console.error('Realtime parse error:', err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      clearTimeout(reconnectTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [router]);

  return null;
}
