# Supabase Function Logs via GitHub Actions

Use this workflow when you need a quick snapshot of Supabase Edge Function logs without shell access.

## One-time setup (manual)

1. In Supabase, go to **Account Settings → Access Tokens → New Token** and create a personal access token with access to the project (use an owner/admin account; do **not** commit this token).
2. Add the following GitHub repository secrets:
   - `SUPABASE_ACCESS_TOKEN`: the personal access token from step 1
   - `SUPABASE_PROJECT_ID`: your project reference (Supabase → Settings → General → Project Reference)

## Running the workflow

1. In GitHub, open **Actions → supabase-function-logs → Run workflow**.
2. Inputs:
   - **environment**: Supabase environment to query (default `prod`; accepts any environment name configured for your project)
   - **since**: How far back to fetch logs (`1h`, `6h`, `24h`, `7d`, etc.)
   - **limit**: Maximum log entries to return (default `400`)
   - **function**: Optional substring filter (function name, request ID, correlation ID)
3. Click **Run workflow**.

## Outputs

- Logs are streamed to the job output and saved as an artifact named `supabase-function-logs.txt` (retained for 7 days).
- The optional **function** input is passed to the Supabase CLI `--search` flag to narrow results.
- If the run fails, double-check that the secrets above are populated and the token still has access to the project.
