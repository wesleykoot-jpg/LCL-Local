// DEV/STAGE Supabase integration wrapper
// - Singleton client
// - Dev-friendly fallbacks and loud warnings
// - Small retry helper + healthCheck helper
// This file is intended for development/staging only. Do not use as-is in production.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

type HealthResult = {
  ok: boolean;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latencyMs?: number;
  error?: string;
};

const ENV = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : (typeof process !== 'undefined' ? process.env : {});

// Read common env names used in this repo (Vite + Node fallback)
const SUPABASE_URL = ENV.VITE_SUPABASE_URL || ENV.SUPABASE_URL || '';
const SUPABASE_KEY =
  ENV.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ENV.VITE_SUPABASE_ANON_KEY ||
  ENV.SUPABASE_ANON_KEY ||
  '';

// Dev fallback placeholders (non-sensitive). These keep the app from hard crashing in dev
const FALLBACK_URL = 'http://localhost:54321';
const FALLBACK_KEY = 'anon-dev-placeholder-key';

// A loud dev-only banner so engineers notice when envs are not provided
function devWarn(message: string) {
  // eslint-disable-next-line no-console
  console.warn(`[supabase - dev-stage] ${message}`);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  devWarn(
    `Missing Supabase environment variables. Using local dev fallbacks.
    Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) to point to your test Supabase project.
    Current values -> URL: ${Boolean(SUPABASE_URL)}, KEY: ${Boolean(SUPABASE_KEY)}`
  );
}

/**
 * Create the client with a singleton pattern so dev HMR doesn't create multiple clients.
 * We prefer the publishable key in env (anon/publishable) just like the original implementation.
 */
let _supabase: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (_supabase) return _supabase;

  const url = SUPABASE_URL || FALLBACK_URL;
  const key = SUPABASE_KEY || FALLBACK_KEY;

  // Create client with a dev-oriented auth settings.
  // Keep storage = localStorage for the browser so sessions persist during dev.
  const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  const storage = isBrowser ? window.localStorage : undefined;

  _supabase = createClient<Database>(url, key, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      // detectSessionInUrl should be false for many SPA dev flows
      detectSessionInUrl: false as any,
    },
    // You may add other dev-friendly options here if required
  });

  // Optional: enable verbose debug if env flag set
  const debugFlag = (ENV.DEV_DEBUG_SUPABASE || ENV.VITE_DEV_DEBUG_SUPABASE || '').toString().toLowerCase();
  if (debugFlag === '1' || debugFlag === 'true') {
    // eslint-disable-next-line no-console
    console.debug('[supabase - dev-stage] debug enabled');
    // Wrap basic network calls if you want to log them in the future.
    // For now, we don't monkeypatch the client; we keep it simple.
  }

  return _supabase;
}

/**
 * Generic retry wrapper for flaky network calls (use in services during dev).
 * - exponential backoff with jitter
 * - default retries = 2 (total attempts = retries + 1)
 */
export async function retry<T>(
  op: () => Promise<T>,
  attempts = 2,
  initialDelayMs = 200
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= attempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === attempts;
      if (isLast) break;
      // backoff with jitter
      const backoff = initialDelayMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 100);
      // eslint-disable-next-line no-console
      console.debug(`[supabase - dev-stage] retry attempt ${attempt + 1} failed, retrying in ${backoff + jitter}ms`);
      await new Promise((res) => setTimeout(res, backoff + jitter));
    }
  }
  // final throw so callers see the original failure
  throw lastErr;
}

/**
 * Lightweight health check:
 * - Performs a small, non-destructive read (limit 1) against a lightweight table.
 * - If your project does not have "profiles", this will return unknown. Modify as needed for your dev schema.
 */
export async function healthCheck(): Promise<HealthResult> {
  const client = getSupabase();
  const start = Date.now();
  try {
    // The call below is intentionally small and non-destructive.
    // It will succeed for projects with a "profiles" table. If not present, treat as unknown.
    const resp = await client.from('profiles').select('id').limit(1).maybeSingle();

    const latency = Date.now() - start;

    // If the request returned an error, report unhealthy
    // resp as any: supabase types vary by runtime; keep this tolerant for dev.
    const anyResp: any = resp;
    if (anyResp?.error) {
      return {
        ok: false,
        status: 'unhealthy',
        latencyMs: latency,
        error: anyResp.error?.message || String(anyResp.error),
      };
    }

    // If the table doesn't exist, return unknown (so devs can decide)
    if (anyResp?.data === null && anyResp?.error === null) {
      return {
        ok: false,
        status: 'unknown',
        latencyMs: latency,
        error: 'no data returned — table might be missing (dev-stage)',
      };
    }

    return {
      ok: true,
      status: 'healthy',
      latencyMs: latency,
    };
  } catch (err: any) {
    const latency = Date.now() - start;
    return {
      ok: false,
      status: 'unhealthy',
      latencyMs: latency,
      error: err?.message || String(err),
    };
  }
}

/**
 * createTestClient: helper for tests that want to supply explicit credentials in code.
 * Use sparingly in dev/e2e flows.
 */
export function createTestClient(url: string, key: string): SupabaseClient<Database> {
  // This does not change the singleton exported by getSupabase(); it's intended for ephemeral test usage.
  return createClient<Database>(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false as any,
    },
  });
}

// Default export kept for compatibility with existing imports that do:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = getSupabase();
export type { HealthResult as SupabaseHealthResult };