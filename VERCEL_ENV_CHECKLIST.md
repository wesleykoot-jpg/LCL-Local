## Vercel Environment Checklist

Quick checklist for deploying this repo to Vercel (frontend) while using Supabase for backend and Edge Functions.

- **Build / Production (Vercel Project Environment — expose to build & client)**
  - `VITE_SUPABASE_URL` = https://<project-ref>.supabase.co
  - `VITE_SUPABASE_PUBLISHABLE_KEY` = <anon/public key>
  - `VITE_SITE_URL` = https://<your-vercel-domain>
  - `VITE_GOOGLE_CLIENT_ID` (if using Google OAuth)
  - Optional for debugging: `VITE_SUPABASE_DEBUG=true`

- **Secrets — Do NOT expose to client (store in Supabase or server-only secrets)**
  - `SUPABASE_SERVICE_ROLE_KEY` — service_role key (for scrapers / server writes)
  - `OPENAI_API_KEY` and/or `GLM_API_KEY` — used by Edge Functions for AI parsing
  - These should be set in **Supabase (Edge Functions env)** or CI/Server secrets. Avoid adding service_role or AI keys as `VITE_` variables.

- **CI / Workflows (GitHub Actions / Deployment workflows)**
  - `SUPABASE_ACCESS_TOKEN` (personal access token for Supabase CLI)
  - `SUPABASE_PROJECT_ID` (project reference ID)
  - `SUPABASE_DB_PASSWORD` (if workflows link to DB)

- **OAuth / Redirects**
  - In Supabase Dashboard > Auth > Settings, add your Vercel domain (e.g., `https://<your-vercel-domain>`) to the redirect URIs.
  - Ensure `VITE_SITE_URL` matches that domain.

- **Local development**
  - Copy `.env.example` to `.env` and fill values: see [.env.example](.env.example#L1)

    ```bash
    cp .env.example .env
    # edit .env and set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, etc.
    ```

  - Confirm frontend reads values in `src/integrations/supabase/client.ts` ([file reference](src/integrations/supabase/client.ts#L1)).

- **Vercel notes**
  - Use Node 18+ in Vercel settings (or add `engines` to `package.json`).
  - Put only client-safe vars (prefixed `VITE_`) in build/production envs on Vercel.
  - For server-only secrets required by serverless endpoints, prefer Supabase Edge Function envs or Vercel Server Environment variables (careful not to expose them to client builds).

- **Final sanity checks before deploy**
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set in Vercel.
  - OAuth redirect URIs include your Vercel domain.
  - `SUPABASE_SERVICE_ROLE_KEY` and AI keys are set in Supabase Edge Functions (not in client envs).

If you want, I can also add a short README section that lists these keys and where to set them.
