# Supabase — Development / Stage Notes

This document explains the dev/stage-focused Supabase integration added to the repository.

Files added / changed
- `src/integrations/supabase/client.ts` — new dev/stage wrapper (singleton + retry + healthCheck)
- `src/pages/SupabaseDebug.tsx` — small dev-only UI to run a health check

Environment variables (Vite / .env)
- `VITE_SUPABASE_URL` — your Supabase project URL (recommended for Vite)
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` — anon/public key
- Optional: `DEV_DEBUG_SUPABASE=true` to enable verbose client debug messages

Developer tips
- The new client will warn (console.warn) if env vars are missing and will fall back to local placeholders for safe dev execution.
- To use the debug page in local dev, import `SupabaseDebug` into `App.tsx` temporarily or run it in Storybook / a sandbox.
  Example quick test import in `App.tsx` (dev only):

  // import SupabaseDebug from './pages/SupabaseDebug';
  // then render `<SupabaseDebug />` somewhere (dev-only)

- The `retry` helper is exported for ad-hoc use in services during dev: `import { retry } from '@/integrations/supabase/client'`.

Important
- These changes are for development/staging only. Remove fallback keys and dev warnings before promoting to production.
