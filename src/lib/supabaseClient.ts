import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseBrowserClient: SupabaseClient | null = null;

/**
 * Returns a shared Supabase client for browser-side Realtime WebSocket subscriptions.
 * Uses public NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Never uses or exposes service_role keys.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (supabaseBrowserClient) return supabaseBrowserClient;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hbydeydzcxedwzebvddk.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  try {
    supabaseBrowserClient = createClient(url, anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
    return supabaseBrowserClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase Realtime browser client:', err);
    return null;
  }
}
