# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automating various tasks in the LCL Local repository.

## Workflows

### 1. Deploy Changed Supabase Functions on PR
**File:** [`deploy-supabase-functions-on-pr.yml`](./deploy-supabase-functions-on-pr.yml)

Automatically deploys Supabase Edge Functions that have been modified in a pull request.

**Triggers:**
- `pull_request` event with types: `[opened, synchronize, reopened, ready_for_review]`

**Path Filter:** Only runs when files under `supabase/functions/**` are changed.

**Behavior:**
1. Checks out the repository with full git history (`fetch-depth: 0`)
2. Sets up Supabase CLI using `supabase/setup-cli@v1`
3. Compares PR branch against base branch to detect changed files using `git diff --name-only`
4. Identifies changed function directories (excludes directories starting with `_` like `_shared`, `_templates`)
5. Deploys each changed function individually using `supabase functions deploy <function-name> --project-ref "$SUPABASE_PROJECT_ID"`
6. Reports deployment success/failure for each function

**Required Secrets:**
- `SUPABASE_ACCESS_TOKEN` - Supabase personal access token (get from: https://app.supabase.com/account/tokens)
- `SUPABASE_PROJECT_ID` - Supabase project reference ID (get from: Project Settings > General > Reference ID)

**Available Edge Functions:**
See [`supabase/functions/`](../../supabase/functions/) for all deployable functions. Current functions include:
- `scrape-events` - Main event scraper
- `scrape-coordinator` - Scraper coordination
- `scrape-worker` - Worker function for scraping
- And more (see directory listing)

**Example:** If you modify files in `supabase/functions/scrape-events/` and `supabase/functions/run-scraper/`, both functions will be deployed automatically when the PR is opened or updated.

---

### 2. Deno Lint and Test
**File:** [`deno.yml`](./deno.yml)

Runs Deno linter and tests on push and pull requests to the main branch.

**Triggers:**
- `push` to `main` branch
- `pull_request` targeting `main` branch

**Steps:**
1. Setup repo with `actions/checkout@v4`
2. Setup Deno v1.x with `denoland/setup-deno@61fe2df320078202e33d7d5ad347e7dcfa0e8f31` (v1.1.2)
3. Run linter: `deno lint`
4. Run tests: `deno test -A`

**Note:** This workflow tests Deno-based code, particularly in the `supabase/functions/` directory and related tests.

---

### 3. Scheduled Scraper
**File:** [`scrape.yml`](./scrape.yml)

Runs the event scraper on a daily schedule or manually via workflow dispatch using the Supabase Edge [`run-scraper`](../../supabase/functions/run-scraper/) function (no local Node.js CLI required).

**Triggers:**
- Scheduled: Daily at 03:00 UTC (cron: `0 3 * * *`)
- Manual: workflow_dispatch

**Steps:**
1. Checkout repository
2. Call the `run-scraper` Edge Function via `curl` with the service role key
3. Parse the JSON response and fail the job if `success` is `false`

**Required Secrets:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` **or** `SUPABASE_KEY` - Supabase service role key for database writes
- `SLACK_WEBHOOK_URL` - Slack webhook for scraper alerts
- `SCRAPER_USER_AGENT` - User agent string for web scraping

**Environment Variables:**
- `MAX_CONSECUTIVE_FAILURES` - Number of consecutive failures before alerting (default: 3)
- `ALERT_SUPPRESSION_MS` - Milliseconds to suppress duplicate alerts (default: 1800000 = 30 min)

**Alternative Architectures:**
- [`supabase/functions/run-scraper/`](../../supabase/functions/run-scraper/) - Direct scraper execution (recommended for scheduled runs)
- [`supabase/functions/scrape-coordinator/`](../../supabase/functions/scrape-coordinator/) - Enqueues scrape jobs for all sources with scheduling logic
- [`supabase/functions/scrape-worker/`](../../supabase/functions/scrape-worker/) - Worker function for processing queued scrape jobs
- [`supabase/functions/scrape-events/`](../../supabase/functions/scrape-events/) - Low-level scraping implementation for individual sources

---

### 4. Supabase Function Logs
**File:** [`supabase-function-logs.yml`](./supabase-function-logs.yml)

Fetches logs from Supabase Edge Functions for debugging and monitoring.

**Trigger:** Manual only (`workflow_dispatch`)

**Inputs:**
- `environment` - Supabase environment (default: `prod`)
- `since` - Time range for logs (default: `24h`, examples: `1h`, `6h`, `7d`)
- `limit` - Maximum number of log entries (default: `400`)
- `function` - Optional substring filter for function name, request ID, or correlation ID

**Steps:**
1. Checkout repository
2. Setup Supabase CLI
3. Execute `supabase functions logs --project-ref "$SUPABASE_PROJECT_ID" --env "$LOG_ENV" --since "$LOG_SINCE" --limit "$LOG_LIMIT"` with optional `--search` filter
4. Save logs to `supabase-function-logs.txt`
5. Upload as artifact (retained for 7 days)

**Required Secrets:**
- `SUPABASE_ACCESS_TOKEN` - Supabase personal access token
- `SUPABASE_PROJECT_ID` - Supabase project reference ID

**Output:** Logs are available as a downloadable artifact named `supabase-function-logs` in the Actions run.

**See Also:** [`docs/supabase-function-logs.md`](../../docs/supabase-function-logs.md) for detailed usage instructions.

---

### 5. Export Edge Logs
**File:** [`export-edge-logs.yml`](./export-edge-logs.yml)

Exports logs from Supabase Edge Functions and commits them to the repository.

**Triggers:**
- Scheduled: Every 15 minutes (cron: `*/15 * * * *`)
- Manual: `workflow_dispatch` with optional `minutes` input

**Inputs (workflow_dispatch only):**
- `minutes` - How many minutes of logs to fetch (default: `15`)

**Steps:**
1. Checkout repository
2. Setup Node.js v20
3. Fetch logs using `scripts/fetch_edge_logs.mjs` script
4. Commit logs to repository under `logs/supabase/**` using `stefanzweifel/git-auto-commit-action@v4`

**Required Secrets:**
- `LOGS_FETCH_URL` - URL endpoint for fetching logs
- `LOGS_FETCH_SECRET` - Optional authentication secret for log endpoint

**Note:** Logs are committed to the `main` branch automatically. Review the `scripts/fetch_edge_logs.mjs` script for implementation details.

---

### 6. NPM Publish to GitHub Packages
**File:** [`npm-publish-github-packages.yml`](./npm-publish-github-packages.yml)

Publishes npm packages to GitHub Packages registry when a release is created.

**Triggers:**
- `release` event with type `created`

**Steps:**
1. **Build Job**: Run tests with `npm ci` and `npm test`
2. **Publish Job** (after build succeeds):
   - Setup Node.js with GitHub Packages registry
   - Install dependencies with `npm ci`
   - Publish package with `npm publish`

**Secrets:**
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions (no manual setup needed)

**Permissions:**
- `contents: read` - Read repository contents
- `packages: write` - Write to GitHub Packages

**Note:** This workflow is triggered by creating a GitHub Release. The package will be published to `@<owner>/<package>` on GitHub Packages.

---

## Setting Up Secrets

To use these workflows, ensure the following secrets are configured in your repository settings (Settings > Secrets and variables > Actions):

### Supabase Secrets
- **SUPABASE_ACCESS_TOKEN**: Personal access token from Supabase
  - Get from: https://app.supabase.com/account/tokens
  - Used by: `deploy-supabase-functions-on-pr.yml`, `supabase-function-logs.yml`
- **SUPABASE_PROJECT_ID**: Your Supabase project reference ID
  - Get from: Supabase project settings > General > Reference ID
  - Used by: `deploy-supabase-functions-on-pr.yml`, `supabase-function-logs.yml`
- **SUPABASE_URL**: Your Supabase project URL (e.g., `https://<project-ref>.supabase.co`)
  - Get from: Supabase project settings > API > Project URL
  - Used by: `scrape.yml`
- **SUPABASE_KEY**: Supabase service role key (for scraper database writes)
  - Get from: Supabase project settings > API > service_role secret
  - ⚠️ **Keep this secret safe!** It bypasses Row Level Security.
  - Used by: `scrape.yml`

### Other Secrets
- **SLACK_WEBHOOK_URL**: Webhook URL for Slack notifications
  - Get from: Slack workspace settings > Incoming Webhooks
  - Used by: `scrape.yml` (for scraper failure alerts)
- **SCRAPER_USER_AGENT**: User agent string for web scraping
  - Example: `LCL-Bot/1.0 (+https://yoursite.com/bot)`
  - Used by: `scrape.yml`
- **LOGS_FETCH_URL**: URL endpoint for fetching logs (optional)
  - Used by: `export-edge-logs.yml`
- **LOGS_FETCH_SECRET**: Authentication secret for log endpoint (optional)
  - Used by: `export-edge-logs.yml`

## Best Practices

1. **Function Changes**: Always test function changes locally before pushing to ensure they deploy successfully.
   - Use `supabase functions serve <function-name>` to test locally
   - See [Supabase Functions documentation](https://supabase.com/docs/guides/functions) for local development
2. **Secrets**: Never commit secrets to the repository. Use GitHub Secrets for sensitive data.
3. **Manual Workflows**: Use `workflow_dispatch` workflows for debugging and one-off tasks.
4. **PR Reviews**: The deploy workflow will run on PRs, allowing you to verify deployments before merging.
5. **Environment Variables**: Configure environment variables in the workflow YAML files, not in secrets (unless sensitive).

## Local Development and Testing

### Testing Edge Functions Locally

1. Install Supabase CLI: `npm install -g supabase`
2. Start local Supabase: `npx supabase start`
3. Serve a function locally:
   ```bash
   npx supabase functions serve scrape-events --env-file .env.local
   ```
4. Test with curl:
   ```bash
   curl -i --location --request POST 'http://localhost:54321/functions/v1/scrape-events' \
     --header 'Authorization: Bearer YOUR_ANON_KEY' \
     --header 'Content-Type: application/json' \
     --data '{"sourceId":"test-source","dryRun":true}'
   ```

### Running Scraper Locally

The scraper can be run via the Edge Function or using the dry-run script:

**Via Edge Function (dry-run mode):**
```bash
# Set environment variables
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run dry-run script for a specific source
./scripts/run-scraper-dryrun.sh <source-id>
```

**Finding Source IDs:**
```sql
SELECT id, name, url FROM scraper_sources WHERE enabled = true;
```

See [`docs/runbook.md`](../../docs/runbook.md) for operational guidance and troubleshooting.

## Troubleshooting

### Deployment Failures

If the `deploy-supabase-functions-on-pr.yml` workflow fails:

1. Check that `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` secrets are set correctly
2. Verify the function code is valid by running `supabase functions deploy <function-name>` locally
3. Check the workflow logs for specific error messages
4. Ensure the function directory structure is correct (should have an `index.ts` or `index.js` file)

### Skipped Deployments

The workflow will skip deployment if:
- Only files in `_shared` or `_templates` directories are changed
- No files under `supabase/functions/` are changed (path filter prevents workflow from running)

This is intentional to avoid unnecessary deployments when only shared utilities or templates are modified.

## Related Documentation

- **Scraper Operations**: [`docs/runbook.md`](../../docs/runbook.md) - Operational runbook for monitoring and troubleshooting the scraper
- **Supabase Function Logs**: [`docs/supabase-function-logs.md`](../../docs/supabase-function-logs.md) - Guide for fetching and analyzing function logs
- **Scraper Implementation**: [`supabase/functions/scrape-events/`](../../supabase/functions/scrape-events/) - Source code for the event scraper
- **Monitoring Stack**: [`lcl-monitoring/`](../../lcl-monitoring/) - Prometheus/Grafana monitoring toolkit
- **Main README**: [`README.md`](../../README.md) - Project overview and architecture
