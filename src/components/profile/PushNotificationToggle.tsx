'use client';

/**
 * PushNotificationToggle
 *
 * A self-contained client component that:
 *  1. Detects browser support for Push API / Service Workers.
 *  2. Shows the current permission status.
 *  3. Lets the user enable or disable punch-in reminders for this device.
 *  4. Registers / unregisters the push subscription via /api/push/subscribe.
 *
 * This component is added to the existing Profile Settings page.
 * It does NOT redesign any existing UI — it only adds a new card below.
 */

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

// The public VAPID key is safe to expose to the browser.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/**
 * Converts a Base64URL-encoded string to a Uint8Array (required by
 * PushManager.subscribe as applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData  = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type SupportStatus = 'checking' | 'unsupported' | 'supported';
type PermissionState = 'default' | 'granted' | 'denied';
type SubscribeStatus = 'idle' | 'loading' | 'subscribed' | 'unsubscribed';

export default function PushNotificationToggle({
  userRole,
  variant = 'profile',
}: {
  userRole: string;
  variant?: 'profile' | 'dashboard';
}) {
  const [support,     setSupport]     = useState<SupportStatus>('checking');
  const [permission,  setPermission]  = useState<PermissionState>('default');
  const [subStatus,   setSubStatus]   = useState<SubscribeStatus>('idle');
  const [currentSub,  setCurrentSub]  = useState<PushSubscription | null>(null);

  // Managers don't receive punch-in reminders — never show on dashboard or profile.
  if (userRole === 'MANAGER') {
    return null;
  }

  // ── Initialise: detect support and existing subscription ──────────────────
  useEffect(() => {
    async function init() {
      if (typeof window === 'undefined') return;

      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasPushManager   = 'PushManager'   in window;

      if (!hasServiceWorker || !hasPushManager) {
        setSupport('unsupported');
        return;
      }
      setSupport('supported');

      // Read current browser permission state.
      const perm = Notification.permission as PermissionState;
      setPermission(perm);

      // Check if this browser already has an active subscription.
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        if (reg) {
          const existing = await reg.pushManager.getSubscription();
          if (existing) {
            setCurrentSub(existing);
            setSubStatus('subscribed');
          } else {
            setSubStatus('unsubscribed');
          }
        } else {
          setSubStatus('unsubscribed');
        }
      } catch {
        setSubStatus('unsubscribed');
      }
    }

    init();
  }, []);

  // ── Enable notifications ──────────────────────────────────────────────────
  async function handleEnable() {
    if (!VAPID_PUBLIC_KEY) {
      toast.error('Push notifications are not configured (missing VAPID key).');
      return;
    }

    setSubStatus('loading');

    try {
      // 1. Request notification permission.
      const perm = await Notification.requestPermission();
      setPermission(perm as PermissionState);

      if (perm !== 'granted') {
        toast.error(
          'Notification permission was denied. Please allow notifications in your browser settings and try again.'
        );
        setSubStatus('unsubscribed');
        return;
      }

      // 2. Register the service worker (or reuse existing registration).
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // 3. Subscribe to the push service.
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });

      const subJson = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      // 4. Send the subscription to WorkSync server.
      const res = await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          endpoint: subJson.endpoint,
          keys:     subJson.keys,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save subscription on server.');
      }

      setCurrentSub(subscription);
      setSubStatus('subscribed');
      toast.success('Punch-in reminders enabled for this device! You\'ll be notified at 11:00 AM on working days.');
    } catch (err: any) {
      console.error('[PushToggle] enable error:', err);
      toast.error(err?.message || 'Failed to enable notifications. Please try again.');
      setSubStatus('unsubscribed');
    }
  }

  // ── Disable notifications ─────────────────────────────────────────────────
  async function handleDisable() {
    setSubStatus('loading');

    try {
      const endpoint = currentSub?.endpoint;

      // 1. Unsubscribe from push service.
      if (currentSub) {
        await currentSub.unsubscribe();
        setCurrentSub(null);
      }

      // 2. Remove from WorkSync server.
      if (endpoint) {
        await fetch('/api/push/subscribe', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint }),
        });
      }

      setSubStatus('unsubscribed');
      toast.success('Punch-in reminders disabled for this device.');
    } catch (err: any) {
      console.error('[PushToggle] disable error:', err);
      toast.error(err?.message || 'Failed to disable notifications.');
      setSubStatus('subscribed'); // Revert on failure.
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isLoading    = support === 'checking' || subStatus === 'loading';
  const isSubscribed = subStatus === 'subscribed';

  // ── Render: Dashboard Compact Banner ──────────────────────────────────────
  if (variant === 'dashboard') {
    // Hidden once subscribed, or during initial support check
    if (isSubscribed || support === 'checking') {
      return null;
    }

    if (support === 'unsupported') {
      return (
        <div className="ws-card p-3 sm:p-3.5 flex items-center gap-2.5 text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-slate-600 dark:text-slate-400">
            <strong className="text-slate-700 dark:text-slate-300">Punch-In Reminders:</strong> Push notifications are not supported in this browser. Use Chrome or Edge on Windows / Android.
          </p>
        </div>
      );
    }

    if (permission === 'denied') {
      return (
        <div className="ws-card p-3 sm:p-3.5 flex items-center gap-2.5 text-xs bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-amber-800 dark:text-amber-300">
            <strong>Punch-In Reminders:</strong> Notifications are blocked in your browser. Allow notifications in site settings to receive reminders.
          </p>
        </div>
      );
    }

    return (
      <div className="ws-card p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-violet-200/70 dark:border-violet-900/50 bg-gradient-to-r from-violet-50/40 via-white to-indigo-50/30 dark:from-violet-950/20 dark:via-slate-900 dark:to-indigo-950/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60 shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                Enable Daily Punch-In Reminders
              </h4>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950 px-1.5 py-0.5 rounded">
                11:00 AM
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Receive one browser notification on working days if you haven&apos;t punched in yet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="h-8 px-3.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-violet-900/20 disabled:opacity-50 cursor-pointer transition shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
            Enable Notifications
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Profile Full Settings Card ────────────────────────────────────
  return (
    <div className="ws-card p-4 sm:p-5 space-y-3.5">
      {/* Card header */}
      <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60">
          <Bell className="w-3.5 h-3.5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            Punch-In Reminders
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Receive one reminder at 11:00 AM on working days if you haven&apos;t punched in.
          </p>
        </div>
      </div>

      {/* Unsupported browser */}
      {support === 'unsupported' && (
        <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
          <div className="space-y-1">
            <p className="font-medium text-slate-700 dark:text-slate-300">Browser not supported</p>
            <p>
              Your browser does not support push notifications. Use{' '}
              <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on Windows / Android.
            </p>
            <p className="text-[11px] text-slate-400">
              On iPhone, add WorkSync to your Home Screen via Safari, then return to this page to enable reminders.
            </p>
          </div>
        </div>
      )}

      {/* Permission denied */}
      {support === 'supported' && permission === 'denied' && (
        <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800/60">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
          <div className="space-y-1 text-amber-800 dark:text-amber-300">
            <p className="font-semibold">Notifications are blocked</p>
            <p>
              To enable reminders, open your browser&apos;s site settings for WorkSync and change
              &ldquo;Notifications&rdquo; to <strong>Allow</strong>, then reload this page.
            </p>
          </div>
        </div>
      )}

      {/* Enabled confirmation */}
      {support === 'supported' && isSubscribed && permission === 'granted' && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2.5 border border-emerald-200 dark:border-emerald-800/60">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>Reminders are active</strong> for this device. You&apos;ll receive one notification at
            11:00 AM on eligible working days.
          </span>
        </div>
      )}

      {/* Action button */}
      {support === 'supported' && permission !== 'denied' && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-slate-400">
            {isSubscribed
              ? 'This device is registered for reminders.'
              : 'This device will not receive reminders until enabled.'}
          </p>

          {isSubscribed ? (
            <button
              onClick={handleDisable}
              disabled={isLoading}
              className="h-8 px-3.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 disabled:opacity-50 cursor-pointer transition"
            >
              {isLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <BellOff className="w-3.5 h-3.5" />}
              Disable Reminders
            </button>
          ) : (
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="h-8 px-3.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-violet-900/20 disabled:opacity-50 cursor-pointer transition"
            >
              {isLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Bell className="w-3.5 h-3.5" />}
              Enable Notifications
            </button>
          )}
        </div>
      )}
    </div>
  );
}
