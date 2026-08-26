import { NextRequest } from 'next/server';
import { appEvents, EVENT_TYPES } from '@/lib/events';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const initPayload = JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() });
      controller.enqueue(encoder.encode("data: " + initPayload + "\n\n"));

      const handlers: { ev: string; fn: (data: any) => void }[] = [];

      Object.values(EVENT_TYPES).forEach((ev) => {
        const fn = (data: any) => {
          try {
            const envelope = {
              type: ev,
              payload: data,
              timestamp: Date.now(),
            };
            const payload = JSON.stringify(envelope);
            controller.enqueue(encoder.encode("data: " + payload + "\n\n"));
          } catch {}
        };
        handlers.push({ ev, fn });
        appEvents.on(ev, fn as any);
      });

      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 10000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        handlers.forEach(({ ev, fn }) => appEvents.off(ev, fn as any));
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}