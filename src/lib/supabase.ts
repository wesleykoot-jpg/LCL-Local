import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Supabase Client Configuration
 * 
 * SECURITY NOTE: Row Level Security (RLS)
 * All database tables MUST have RLS policies enabled in Supabase to protect user data.
 * 
 * Required RLS Policies:
 * - profiles: Users can read all profiles, but only update their own
 * - events: Public read access, authenticated users can create
 * - event_attendees: Users can only create/read/update their own attendance records
 * - persona_stats: Users can only read/update their own stats
 * - persona_badges: Users can only read/update their own badges
 * 
 * IMPORTANT: The anon key used here only grants access controlled by RLS policies.
 * Server-side operations requiring elevated privileges should use the service role key.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('[Supabase Config Check]', {
  url: supabaseUrl ? 'CONFIGURED' : '❌ MISSING VITE_SUPABASE_URL',
  anonKey: supabaseAnonKey ? 'CONFIGURED' : '❌ MISSING VITE_SUPABASE_ANON_KEY',
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey
});

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL is not set in your .env file');
}
if (!supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY is not set in your .env file');
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
