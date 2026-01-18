# Event Scraper End-to-End Guide

This guide walks you through debugging and running the event scraper to inject at least 50 new events into the LCL Local database.

## Quick Start

### Prerequisites

You need the following environment variables:

```bash
# Required
export SUPABASE_URL="https://mlpefjsbriqgxcaqxhic.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"  # NOT the anon key!

# For AI event parsing (highly recommended)
export GEMINI_API_KEY="your-gemini-api-key"  # or GOOGLE_AI_API_KEY

# For source discovery (optional but recommended)
export SERPER_API_KEY="your-serper-api-key"

# For Slack notifications (optional)
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### Getting the Service Role Key

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/mlpefjsbriqgxcaqxhic
2. Navigate to **Settings > API**
3. Copy the **service_role** key (NOT the anon key)

### Running the E2E Test Script

```bash
# Make the script executable
chmod +x scripts/run-e2e-scraper-test.sh

# Check current database state
./scripts/run-e2e-scraper-test.sh check

# Run scraper in dry-run mode (no database writes)
./scripts/run-e2e-scraper-test.sh dry-run

# Run scraper with database writes
./scripts/run-e2e-scraper-test.sh scrape

# Run source discovery to find new sources
./scripts/run-e2e-scraper-test.sh discover

# Run full pipeline: discovery + scraping
./scripts/run-e2e-scraper-test.sh full

# Run initial load: full E2E discovery-to-ingestion flow with validation & metrics
./scripts/run-e2e-scraper-test.sh initial-load

# Validate discovered sources and check data integrity
./scripts/run-e2e-scraper-test.sh validate

# Generate success metrics report
./scripts/run-e2e-scraper-test.sh metrics
```

### Initial Load Mode (Recommended for New Deployments)

The `initial-load` mode executes a complete 5-step discovery-to-ingestion flow:

1. **Broad Source Discovery**: Calls the `source-discovery` edge function with parameters:
   - `minPopulation`: 15000
   - `maxMunicipalities`: 50
   - `dryRun`: false

2. **Source Validation & Filtering**: Inspects the `scraper_sources` table for:
   - Sources where `last_scraped_at` is NULL
   - Sources where `total_events_scraped` is 0
   - Verifies confidence scores are above 60

3. **Live Scraper Execution**: Triggers the `scrape-events` edge function with:
   - `dryRun`: false (writes to production)
   - Self-healing: Automatically upgrades `fetcher_type` from static to dynamic if needed

4. **Verification & Data Integrity**: Checks:
   - Event fingerprint uniqueness
   - No duplicate events from the same source
   - Source health status

5. **Success Metrics Reporting**: Reports:
   - New Sources Discovered
   - Successful Scrapes
   - Total Events Ingested
   - Failed Sources (with error types)

## Architecture Overview

The scraper has three main execution paths:

### 1. Direct Scraper (`scrape-events`)
- Single function that scrapes all enabled sources
- Best for: Small number of sources, quick testing

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/scrape-events" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"enableDeepScraping": true}'
```

### 2. Enhanced Scraper (`run-scraper`)
- Better error handling and logging
- Best for: Production runs

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/run-scraper" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"enableDeepScraping": true}'
```

### 3. Distributed Worker System (`scrape-coordinator` + `scrape-worker`)
- Job queue-based architecture
- Parallel workers (up to 5 concurrent)
- Best for: Large number of sources (100+)

```bash
# Enqueue jobs for all sources
curl -X POST "${SUPABASE_URL}/functions/v1/scrape-coordinator" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"triggerWorker": true}'
```

## Source Discovery

The `source-discovery` function automatically finds new event sources:

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/source-discovery" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "minPopulation": 15000,
    "maxMunicipalities": 50,
    "dryRun": false
  }'
```

### How it works:
1. Selects Dutch municipalities by population
2. Uses Serper.dev (if SERPER_API_KEY is set) for web search
3. Falls back to pattern-based discovery otherwise
4. Validates sources with Gemini LLM
5. Auto-enables sources with confidence >90%

## Getting 50+ New Events

To achieve the target of 50+ new events:

### Step 1: Enable More Sources

First, check what sources are currently enabled:

```sql
SELECT id, name, url, enabled, auto_disabled, consecutive_failures, total_events_scraped
FROM scraper_sources
ORDER BY enabled DESC, name;
```

Enable disabled sources that look promising:

```sql
UPDATE scraper_sources 
SET enabled = true, auto_disabled = false, consecutive_failures = 0
WHERE name LIKE '%Meppel%';  -- Example
```

### Step 2: Run Source Discovery

Discover new sources for Dutch municipalities:

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/source-discovery" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "minPopulation": 15000,
    "maxMunicipalities": 50,
    "dryRun": false
  }'
```

### Step 3: Run the Scraper

```bash
# Using the enhanced scraper
curl -X POST "${SUPABASE_URL}/functions/v1/run-scraper" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"enableDeepScraping": true}'
```

### Step 4: Verify Results

```sql
-- Count events from the last 24 hours
SELECT COUNT(*) as new_events
FROM events
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Events by category
SELECT category, COUNT(*) as count
FROM events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY category
ORDER BY count DESC;

-- Events by source
SELECT s.name, COUNT(e.id) as event_count
FROM events e
JOIN scraper_sources s ON e.source_id = s.id
WHERE e.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY s.name
ORDER BY event_count DESC;
```

## Debugging Common Issues

### 1. "No enabled sources"

Check if sources are enabled and not auto-disabled:

```sql
SELECT * FROM scraper_sources 
WHERE enabled = true 
AND (auto_disabled = false OR auto_disabled IS NULL);
```

Reset auto-disabled sources:

```sql
UPDATE scraper_sources 
SET enabled = true, auto_disabled = false, consecutive_failures = 0
WHERE auto_disabled = true;
```

### 2. No events being scraped

Check the scraper source stats:

```sql
SELECT name, url, last_scraped_at, last_error, total_events_scraped, consecutive_failures
FROM scraper_sources
ORDER BY last_scraped_at DESC NULLS LAST;
```

### 3. Events not appearing in feed

Verify events have valid dates and locations:

```sql
SELECT id, title, event_date, location, category
FROM events
WHERE event_date >= NOW()
ORDER BY event_date ASC
LIMIT 20;
```

Check for events with missing coordinates (fallback POINT(0 0)):

```sql
SELECT id, title, venue_name, ST_AsText(location) as location
FROM events
WHERE location = ST_GeomFromText('POINT(0 0)', 4326);
```

### 4. Checking scraper logs

In Supabase Dashboard:
1. Go to **Edge Functions**
2. Select the function (e.g., `run-scraper`)
3. Click **Logs** tab

Or use the Supabase CLI:

```bash
supabase functions logs run-scraper --project-ref mlpefjsbriqgxcaqxhic
```

## Known Event Sources

The scraper supports Dutch municipality event pages with patterns like:

- `https://www.visit[city].nl/agenda`
- `https://www.ontdek[city].nl/agenda`
- `https://www.uitagenda[city].nl`
- `https://www.[city].nl/evenementen`
- `https://agenda.[city].nl`

### Pre-verified Sources

Major Dutch cities have known working sources in `source-discovery/index.ts`:
- Amsterdam (iamsterdam.com, uitagendaamsterdam.nl)
- Rotterdam (uitagendarotterdam.nl, rotterdamfestivals.nl)
- Utrecht (utrechtverwelkomt.nl, visit-utrecht.com)
- Den Haag (denhaag.nl, denhaag.com)
- And 20+ more cities

## Database Schema

### `scraper_sources` table
- `id`: UUID primary key
- `name`: Human-readable name
- `url`: Base URL for scraping
- `enabled`: Whether to scrape this source
- `auto_disabled`: Set to true when too many failures
- `consecutive_failures`: Failure counter
- `fetcher_type`: 'static' | 'puppeteer' | 'playwright' | 'scrapingbee'
- `default_coordinates`: PostGIS point for geocoding fallback
- `config`: JSON with selectors, headers, rate limits

### `events` table
- `id`: UUID primary key
- `title`: Event title
- `description`: Event description
- `category`: One of: active, gaming, entertainment, social, family, outdoors, music, workshops, foodie, community
- `event_type`: 'anchor' | 'fork' | 'signal'
- `event_date`: ISO timestamp
- `venue_name`: Location name
- `location`: PostGIS geography(POINT, 4326) - **longitude first!**
- `source_id`: Reference to scraper_sources
- `event_fingerprint`: SHA256 hash for deduplication

## Scheduling (Future)

For incremental updates after the initial discovery phase, set up a scheduled job:

### Using pg_cron (Supabase)

```sql
-- Run scraper daily at 6 AM
SELECT cron.schedule(
  'daily-scrape',
  '0 6 * * *',  -- Cron expression
  $$
  SELECT net.http_post(
    url:='https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/scrape-coordinator',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body:='{"triggerWorker": true}'::jsonb
  );
  $$
);
```

### Using GitHub Actions

Create `.github/workflows/scrape.yml`:

```yaml
name: Scheduled Scrape
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Scraper
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/run-scraper" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"enableDeepScraping": true}'
```

## Support

For issues:
1. Check the Supabase Edge Function logs
2. Review `scraper_sources.last_error` column
3. Check `scrape_jobs` table for failed jobs
4. Review this guide's debugging section
