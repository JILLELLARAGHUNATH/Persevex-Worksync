/**
 * WorkSync Service Worker — Punch-In Reminder Push Notifications
 *
 * Responsibilities:
 *  1. Receive push events from the server.
 *  2. Show a WorkSync punch-in reminder notification.
 *  3. On click: open (or focus) the employee's attendance page.
 *  4. Handle malformed payloads gracefully.
 *
 * This service worker intentionally has NO offline caching or PWA install
 * behaviour — it exists only to support Web Push.
 */

'use strict';

const SW_VERSION = 'worksync-push-v2';

// ── Push event ────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {
    title: 'WorkSync — Punch-In Reminder',
    body: "Good morning! Don't forget to punch in on WorkSync when you arrive at the office.",
    url: '/employee',
    icon: '/favicon.png',
    badge: '/favicon.png',
  };

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) payload.title = data.title;
      if (data.body)  payload.body  = data.body;
      if (data.url)   payload.url   = data.url;
    } catch (_) {
      // Malformed JSON — fall through and use the defaults above.
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: 'worksync-punchin-reminder',   // Replaces any previous reminder notification.
    renotify: false,
    requireInteraction: false,
    data: { url: payload.url },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/employee';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Try to focus an already-open WorkSync tab.
        for (const client of windowClients) {
          try {
            const clientUrl = new URL(client.url);
            const origin = self.location.origin || clientUrl.origin;
            if (clientUrl.origin === origin) {
              client.navigate(targetUrl);
              return client.focus();
            }
          } catch (_) {}
        }
        // No open tab — open a new one.
        return clients.openWindow(targetUrl);
      })
  );
});

// ── Install / Activate — skip waiting so the new SW takes effect immediately ─
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
