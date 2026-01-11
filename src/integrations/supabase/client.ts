// Supabase client configuration for LCL Local
// Contains development helpers and debug logging options
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Development configuration flags
const isDev = import.meta.env.DEV;
const isDebugEnabled = import.meta.env.VITE_SUPABASE_DEBUG === 'true';

// Validate environment variables in development
if (isDev) {
  if (!SUPABASE_URL) {
    console.error('[Supabase] Missing VITE_SUPABASE_URL. Copy .env.example to .env and configure.');
  }
  if (!SUPABASE_PUBLISHABLE_KEY) {
    console.error('[Supabase] Missing VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and configure.');
  }
  if (isDebugEnabled) {
    console.log('[Supabase] Debug mode enabled');
    console.log('[Supabase] URL:', SUPABASE_URL);
    console.log('[Supabase] Using local:', SUPABASE_URL?.includes('localhost') || SUPABASE_URL?.includes('127.0.0.1'));
  }
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Auto-confirm in development for easier testing
    ...(isDev && { detectSessionInUrl: true }),
  },
  // Enable debug logging in development when VITE_SUPABASE_DEBUG is set
  ...(isDebugEnabled && {
    global: {
      fetch: (...args) => {
        console.log('[Supabase Request]', args[0]);
        return fetch(...args)
          .then(response => {
            console.log('[Supabase Response]', response.status, args[0]);
            return response;
          })
          .catch(error => {
            console.error('[Supabase Error]', args[0], error);
            throw error;
          });
      },
    },
  }),
});

// Development helper: Check if using local Supabase
export const isLocalSupabase = () => {
  return SUPABASE_URL?.includes('localhost') || SUPABASE_URL?.includes('127.0.0.1');
};

// Development helper: Get current configuration info
export const getSupabaseConfig = () => ({
  url: SUPABASE_URL,
  isLocal: isLocalSupabase(),
  isDev,
  isDebugEnabled,
});