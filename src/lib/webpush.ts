/**
 * Server-side Web Push helper for WorkSync punch-in reminders.
 *
 * Uses the `web-push` npm package with VAPID authentication.
 * VAPID keys and private key are read from environment variables —
 * never exposed to the browser.
 */

import webpush from 'web-push';

let isConfigured = false;

function ensureVapidConfigured() {
  if (isConfigured) return;

  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email      = process.env.VAPID_EMAIL || 'mailto:support@persevex.com';

  if (!publicKey || !privateKey) {
    throw new Error(
      '[webpush] Missing VAPID keys. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env'
    );
  }

  webpush.setVapidDetails(email, publicKey, privateKey);
  isConfigured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends a single Web Push notification.
 *
 * @returns 'sent'      — push service accepted the request (2xx).
 * @returns 'gone'      — subscription is expired/invalid (410/404). Caller should delete it.
 * @returns 'error'     — unexpected failure.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<'sent' | 'gone' | 'error'> {
  ensureVapidConfigured();

  const pushSubscription: webpush.PushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth:   subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 3600, // 1 hour — if device is offline, deliver within the hour.
        urgency: 'normal',
      }
    );
    return 'sent';
  } catch (err: any) {
    const statusCode = err?.statusCode ?? err?.response?.statusCode;
    if (statusCode === 410 || statusCode === 404) {
      // Push service signals the subscription is no longer valid.
      return 'gone';
    }
    console.error('[webpush] sendPushNotification error:', err?.message ?? err);
    return 'error';
  }
}
