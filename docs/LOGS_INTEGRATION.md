# Supabase Logs Integration — fetch-last-15min-logs

This PR adds:
- A Supabase Edge Function: fetch-last-15min-logs
- A GitHub Action that calls the function every 15 minutes and commits logs under logs/supabase/
- A small Node ESM script that calls the Edge Function and redacts sensitive fields
- Copilot/GPT prompt templates for analyzing logs

Deployment & Setup
1. Deploy the Edge Function:
   - From your project root with the Supabase CLI:
     supabase functions deploy fetch-last-15min-logs
   - The function environment will automatically have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY available.
   - Optional: set LOGS_FETCH_SECRET in the function environment to a random token for protection.

2. Set GitHub repository secrets (Settings -> Secrets -> Actions):
   - LOGS_FETCH_URL: the public URL of the deployed Edge Function (e.g. https://<project>.functions.supabase.co/fetch-last-15min-logs)
   - LOGS_FETCH_SECRET: (optional) same token as LOGS_FETCH_SECRET in Edge Function env if you enabled it

3. Trigger the GitHub Action manually (Actions -> Export Supabase Edge Logs -> Run workflow) or wait for the schedule.

4. Verify logs appear in the repo under logs/supabase/YYYY-MM-DD/*.jsonl

Notes & Security
- Do NOT store SUPABASE_SERVICE_ROLE_KEY in GitHub secrets. Keep it in the Supabase function environment only.
- The script redacts common token keys and truncates long request bodies. Review and add more redaction rules if needed.
- Adjust cron schedule in .github/workflows/export-edge-logs.yml if you prefer 5/10/30 minute intervals.

Testing
- After deploying the function, test locally with curl (replace with your function URL):
  curl -H "x-log-fetch-token: <SECRET>" "<LOGS_FETCH_URL>?minutes=15"

- After running the GitHub Action, inspect the committed logs under logs/supabase/.

Rollback
- Remove the GitHub Action or disable the workflow dispatch to stop commits.

Contact
If anything fails during deployment I will review the workflow run logs and Edge Function response and iterate on fixes.
