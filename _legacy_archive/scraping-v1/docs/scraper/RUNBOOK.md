# Scraper Runbook

## Overview

The LCL Local defensive scheduled scraper runs daily to fetch event data from configured sources. This runbook provides operational guidance for monitoring, troubleshooting, and responding to scraper failures.

## Quick Links

- **Supabase Tables**: 
  - `scrape_events`: Individual fetch attempts
  - `scrape_state`: Per-source state and failure counters
  - `scraper_sources`: Scraping configuration and enabled sources
- **GitHub Actions**: [`.github/workflows/scrape.yml`](../.github/workflows/scrape.yml)
- **Scraper Implementation**: [`supabase/functions/scrape-events/`](../supabase/functions/scrape-events/)
- **Dry-run Script**: [`scripts/run-scraper-dryrun.sh`](../scripts/run-scraper-dryrun.sh)

## Monitoring

### Viewing Scrape Events

To view the latest scrape attempts in Supabase:

1. Navigate to your Supabase project dashboard
2. Go to **Table Editor** → `scrape_events`
3. Filter by `run_id` to see events from a specific run
4. Sort by `created_at DESC` to see most recent attempts

### Checking Source State

To check the current state of a source:

1. Go to **Table Editor** → `scrape_state`
2. Find the row for your `source_id`
3. Key columns:
   - `consecutive_failures`: Number of consecutive failures
   - `last_success_at`: When the source last succeeded
   - `last_alert_at`: When the last alert was sent
   - `last_http_status`: Most recent HTTP status code

### Slack Alerts

Critical alerts are sent to the configured Slack webhook when:
- A source has `MAX_CONSECUTIVE_FAILURES` (default: 3) consecutive failures
- Alert suppression window has passed (default: 30 minutes)

Each alert includes:
- Source ID and URL
- Run ID for tracing
- HTTP status codes and error details
- Link to Supabase events
- Suggested remediation

## Common Failure Scenarios

### HTTP 5xx Errors (Server-Side)

**Symptoms**: Repeated `500`, `502`, `503`, or `504` status codes

**Likely Causes**:
- Target site is experiencing downtime or high load
- Server-side rate limiting or automation detection
- Temporary infrastructure issues

**Response**:
1. Wait and monitor - may resolve automatically
2. Check if target site is accessible in a browser
3. If persistent (>24h), contact site owner to report issues
4. Consider adjusting scraper configuration:
   - Increase backoff delays
   - Reduce request rate
   - Lower concurrency

### HTTP 429 (Rate Limiting)

**Symptoms**: `429 Too Many Requests` status codes

**Likely Causes**:
- Exceeding target site's rate limits
- Not respecting `Retry-After` header
- robots.txt `Crawl-delay` not being honored

**Response**:
1. Verify robots.txt compliance:
   ```bash
   curl https://example.com/robots.txt
   ```
2. Check scraper configuration in `sources.json`:
   - Reduce `requests_per_minute`
   - Ensure `concurrency` is set to 1
3. Monitor for `Retry-After` header in events
4. If persistent, contact site owner for permission or API access

### Network Timeouts

**Symptoms**: Null HTTP status with timeout errors in event logs

**Likely Causes**:
- Network connectivity issues
- Target site is very slow to respond
- Firewall or IP blocking

**Response**:
1. Check if target site is accessible:
   ```bash
   curl -I https://example.com
   ```
2. Test from different network/IP if possible
3. Review timeout configuration (default: 30s)
4. Consider increasing timeout for slow sites
5. Check for IP-based blocking (contact site owner)

### Parsing/Schema Errors

**Symptoms**: Error messages mentioning "parse", "schema", or malformed content

**Likely Causes**:
- Target site changed HTML structure
- New CMS version deployed
- Different content format than expected

**Response**:
1. Compare recent successful event bodies with current ones in `scrape_events`
2. Update parser logic to handle new structure
3. Test with dry-run mode:
   ```bash
   # Set environment variables
   export SUPABASE_URL="https://<project-ref>.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   
   # Run dry-run for a specific source
   ./scripts/run-scraper-dryrun.sh <source-id>
   ```
4. Deploy updated scraper code

### Robots.txt Blocking

**Symptoms**: Events with error "Disallowed by robots.txt"

**Likely Causes**:
- User agent is explicitly blocked
- URL path is disallowed for all agents
- robots.txt rules changed

**Response**:
1. Fetch and review robots.txt:
   ```bash
   curl https://example.com/robots.txt
   ```
2. Check if our user agent or URL path is disallowed
3. Options:
   - Request permission from site owner
   - Use different user agent (only if permitted)
   - Find alternative URL endpoint
   - Remove source if blocking is intentional

## Manual Interventions

### Resetting Consecutive Failures

If an alert was a false positive or issue is resolved, reset the failure counter:

```sql
UPDATE scrape_state 
SET consecutive_failures = 0, 
    note = 'Manually reset - issue resolved'
WHERE source_id = 'your-source-id';
```

### Disabling a Source Temporarily

To temporarily skip a problematic source without removing it:

```sql
-- Disable a source in the database
UPDATE scraper_sources 
SET enabled = false,
    notes = 'Temporarily disabled - issue being investigated'
WHERE id = 'your-source-id';

-- Re-enable when ready
UPDATE scraper_sources 
SET enabled = true,
    notes = NULL
WHERE id = 'your-source-id';
```

The next workflow run will skip disabled sources automatically.

### Triggering a Manual Run

To run the scraper outside the schedule:

1. Go to **GitHub Actions** → [`scheduled-scrape`](https://github.com/wesleykoot-jpg/LCL-Local/actions/workflows/scrape.yml)
2. Click **Run workflow**
3. Workflow will execute with the environment variables configured in the workflow file

**Note:** The scraper runs via a scheduled GitHub Actions workflow that invokes the `run-scraper` Supabase Edge Function via HTTP. For testing individual sources with dry-run mode, use the `./scripts/run-scraper-dryrun.sh` script instead.

### Running Locally

For testing and debugging:

```bash
# Set environment variables
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export SLACK_WEBHOOK_URL="your-slack-webhook"  # Optional
export SCRAPER_USER_AGENT="LCL-Bot/1.0"        # Optional

# Dry run using the Edge Function
./scripts/run-scraper-dryrun.sh <source-id>

# Note: The scraper runs as a Supabase Edge Function.
# See .github/workflows/scrape.yml for the scheduled workflow configuration.
```

**Finding Source IDs:**
```sql
SELECT id, name, url FROM scraper_sources WHERE enabled = true;
```

**Edge Function Details:**
- Function: `supabase/functions/scrape-events/index.ts`
- Dry-run mode: Pass `{"dryRun": true}` in request body to test without writing to database
- Local testing: Use `npx supabase functions serve scrape-events`

## Configuration Tuning

### Adjusting Rate Limits

Rate limits are typically configured in the `scraper_sources` table. Check and modify per-source settings:

```sql
-- View current rate limit settings
SELECT id, name, url, config FROM scraper_sources WHERE enabled = true;

-- Update rate limit for a specific source
UPDATE scraper_sources 
SET config = jsonb_set(
  config, 
  '{rate_limit}', 
  '{"requests_per_minute": 6, "concurrency": 1}'::jsonb
)
WHERE id = 'your-source-id';
```

**Note:** Configuration may vary by source. Some sources store rate limits in the `config` JSONB column.

### Changing Alert Threshold

Set environment variable in GitHub Actions workflow:

```yaml
env:
  MAX_CONSECUTIVE_FAILURES: 5  # Alert after 5 failures instead of 3
```

### Adjusting Alert Suppression

Prevent alert spam by increasing suppression window:

```yaml
env:
  ALERT_SUPPRESSION_MS: 3600000  # 1 hour instead of 30 minutes
```

## Security Best Practices

### Secret Rotation

If Slack webhook is compromised:

1. Generate new webhook in Slack settings
2. Update `SLACK_WEBHOOK_URL` secret in GitHub repository
3. Old webhook will be automatically invalidated

### Supabase Key Rotation

If Supabase key is compromised:

1. Generate new service role key in Supabase dashboard
2. Update `SUPABASE_KEY` secret in GitHub repository
3. Revoke old key in Supabase

## Troubleshooting Checklist

- [ ] Check Slack channel for recent alerts
- [ ] Review `scrape_events` table for error patterns
- [ ] Check `scrape_state` for consecutive failure counts
- [ ] Verify robots.txt compliance
- [ ] Test URL accessibility from different networks
- [ ] Review recent code changes that might affect scraping
- [ ] Check GitHub Actions logs for workflow failures
- [ ] Verify all required secrets are set in GitHub repository

## Support

For issues not covered in this runbook:
- Check project documentation in repository
- Review GitHub Actions workflow logs
- Contact repository maintainers

## Related Documentation

- [Configuration Guide](../supabase/functions/scrape-events/README.md)
- [GitHub Actions Workflow](../.github/workflows/scrape.yml)
- [GitHub Workflows README](../.github/workflows/README.md)
- [Supabase Functions Documentation](../supabase/functions/)
- [Monitoring Toolkit](../lcl-monitoring/README.md)
