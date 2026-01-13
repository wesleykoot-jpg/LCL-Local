# Scraper Runbook

## Overview

The LCL Local defensive scheduled scraper runs daily to fetch event data from configured sources. This runbook provides operational guidance for monitoring, troubleshooting, and responding to scraper failures.

## Quick Links

- **Supabase Tables**: 
  - `scrape_events`: Individual fetch attempts
  - `scrape_state`: Per-source state and failure counters
- **GitHub Actions**: `.github/workflows/scrape.yml`
- **Configuration**: `src/config/sources.json`

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
   npm run scrape:dry-run
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

1. Remove the source from `src/config/sources.json`
2. Commit and push changes
3. Next workflow run will skip this source

### Triggering a Manual Run

To run the scraper outside the schedule:

1. Go to **GitHub Actions** → `scheduled-scrape`
2. Click **Run workflow**
3. Optionally enable dry-run mode in workflow inputs

### Running Locally

For testing and debugging:

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_KEY="your-supabase-key"
export SLACK_WEBHOOK_URL="your-slack-webhook"

# Dry run (no writes)
npm run build
node dist/cli.js --dry-run

# Real run
node dist/cli.js --run-id=local-test-001
```

## Configuration Tuning

### Adjusting Rate Limits

Edit `src/config/sources.json` for per-source settings:

```json
{
  "source_id": "example.site",
  "url": "https://example.com/events",
  "domain": "example.com",
  "rate_limit": {
    "requests_per_minute": 6,  // Slower rate (10s per request)
    "concurrency": 1            // Keep at 1 for politeness
  }
}
```

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

- [Configuration Guide](../src/config/defaults.ts)
- [GitHub Actions Workflow](.github/workflows/scrape.yml)
- [Supabase Schema](../supabase/migrations/20260113000000_scraper_defensive_schema.sql)
