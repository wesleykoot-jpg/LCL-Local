# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automating various tasks in the LCL Local repository.

## Workflows

### 1. Deploy Changed Supabase Functions on PR
**File:** `deploy-supabase-functions-on-pr.yml`

Automatically deploys Supabase Edge Functions that have been modified in a pull request.

**Triggers:**
- Pull request opened
- Pull request synchronized (new commits pushed)
- Pull request reopened
- Pull request marked ready for review

**Path Filter:** Only runs when files under `supabase/functions/**` are changed.

**Behavior:**
1. Checks out the repository with full git history
2. Sets up Supabase CLI
3. Compares PR branch against base branch to detect changed files
4. Identifies changed function directories (excludes `_shared`, `_templates`, and other directories starting with `_`)
5. Deploys each changed function individually using `supabase functions deploy`
6. Reports deployment success/failure for each function

**Required Secrets:**
- `SUPABASE_ACCESS_TOKEN` - Supabase personal access token
- `SUPABASE_PROJECT_ID` - Supabase project reference ID

**Example:** If you modify files in `supabase/functions/scrape-events/` and `supabase/functions/run-scraper/`, both functions will be deployed automatically when the PR is opened or updated.

---

### 2. Deno Lint and Test
**File:** `deno.yml`

Runs Deno linter and tests on push and pull requests to the main branch.

**Triggers:**
- Push to main branch
- Pull requests targeting main branch

**Steps:**
1. Setup Deno
2. Run linter (`deno lint`)
3. Run tests (`deno test -A`)

---

### 3. Scheduled Scraper
**File:** `scrape.yml`

Runs the event scraper on a daily schedule or manually via workflow dispatch.

**Triggers:**
- Scheduled: Daily at 03:00 UTC
- Manual: workflow_dispatch

**Required Secrets:**
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SLACK_WEBHOOK_URL`
- `SCRAPER_USER_AGENT`

---

### 4. Supabase Function Logs
**File:** `supabase-function-logs.yml`

Fetches logs from Supabase Edge Functions for debugging and monitoring.

**Trigger:** Manual only (workflow_dispatch)

**Inputs:**
- `environment` - Supabase environment (default: prod)
- `since` - Time range for logs (default: 24h)
- `limit` - Maximum number of log entries (default: 400)
- `function` - Optional filter for function name

**Required Secrets:**
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`

---

### 5. Export Edge Logs
**File:** `export-edge-logs.yml`

Exports logs from Supabase Edge Functions.

**Trigger:** Manual only (workflow_dispatch)

---

### 6. NPM Publish to GitHub Packages
**File:** `npm-publish-github-packages.yml`

Publishes npm packages to GitHub Packages registry.

**Trigger:** Configurable

---

## Setting Up Secrets

To use these workflows, ensure the following secrets are configured in your repository settings:

### Supabase Secrets
- **SUPABASE_ACCESS_TOKEN**: Personal access token from Supabase
  - Get from: https://app.supabase.com/account/tokens
- **SUPABASE_PROJECT_ID**: Your Supabase project reference ID
  - Get from: Supabase project settings > General > Reference ID
- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_KEY**: Supabase service role key (for scraper)

### Other Secrets
- **SLACK_WEBHOOK_URL**: Webhook URL for Slack notifications
- **SCRAPER_USER_AGENT**: User agent string for web scraping

## Best Practices

1. **Function Changes**: Always test function changes locally before pushing to ensure they deploy successfully.
2. **Secrets**: Never commit secrets to the repository. Use GitHub Secrets for sensitive data.
3. **Manual Workflows**: Use workflow_dispatch workflows for debugging and one-off tasks.
4. **PR Reviews**: The deploy workflow will run on PRs, allowing you to verify deployments before merging.

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
