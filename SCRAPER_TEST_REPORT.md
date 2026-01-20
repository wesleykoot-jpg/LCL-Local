# LCL Scraper Full Test Report

**Date:** January 20, 2026  
**Test Environment:** GitHub Actions Sandbox  
**Status:** ⚠️ Partial - Network restrictions prevented live scraping

## Executive Summary

The full scraper test was attempted but encountered limitations:
1. **Edge Functions Not Accessible** - The scrape-coordinator and scrape-worker edge functions return 400 errors from Cloudflare
2. **Network Restrictions** - The sandbox environment cannot fetch external websites
3. **Database Analysis Completed** - Full analysis of existing scraper data was performed

## Current Scraper State

### Sources Overview
| Metric | Value |
|--------|-------|
| Total Sources | 281 |
| Enabled Sources | 192 (68.3%) |
| Sources with Events | 114 (40.6%) |
| Sources with 0 Events | 167 (59.4%) |
| **Total Events Scraped (all-time)** | **13,634** |

### Fetcher Type Distribution

| Fetcher Type | Sources | Enabled | Events | % Events |
|--------------|---------|---------|--------|----------|
| **static** | 203 | 114 | 13,634 | 100.0% |
| scrapingbee | 63 | 63 | 0 | 0.0% |
| puppeteer | 15 | 15 | 0 | 0.0% |

**Key Finding:** All events (100%) were scraped by sources using the 'static' fetcher. The scrapingbee and puppeteer fetchers have not produced any events.

### Preferred Extraction Method

| Method | Sources | Events | Zero-Event Sources |
|--------|---------|--------|-------------------|
| auto | 281 | 13,634 | 167 |

All sources are configured with `preferred_method: 'auto'`, meaning the waterfall extraction tries strategies in this order:
1. **HYDRATION** - Next.js/__NEXT_DATA__, Nuxt, React state
2. **JSON-LD** - Schema.org structured data
3. **FEED** - RSS/Atom/ICS discovery
4. **DOM** - CSS selector-based extraction

## Waterfall Strategy Distribution

### ⚠️ No Insights Recorded

The `scraper_insights` table exists but contains **NO DATA**. This means:
- The waterfall extraction logic IS implemented in `supabase/functions/_shared/dataExtractors.ts`
- The scrape-worker IS configured to call `logScraperInsight()` 
- However, no scraper runs have logged insights to the database yet

### Expected Insights Data

Once the scraper runs with insights logging enabled, you would see:

```
Strategy       | Runs | Events | % Runs  | % Events
─────────────────────────────────────────────────────
hydration      | XX   | XXXX   | XX.X%   | XX.X%
json_ld        | XX   | XXXX   | XX.X%   | XX.X%
feed           | XX   | XXXX   | XX.X%   | XX.X%
dom            | XX   | XXXX   | XX.X%   | XX.X%
NONE           | XX   | 0      | XX.X%   | 0.0%
```

## Top Performing Sources

| Source | Events | Fetcher | Method |
|--------|--------|---------|--------|
| Theaterkrant Agenda | 1,081 | static | auto |
| Muziekladder Groningen Muziek Agenda | 1,062 | static | auto |
| Grachtenfestival Meppel 2026 | 640 | static | auto |
| Agenda Meppel | 484 | static | auto |
| Grand Theatre Groningen Programma | 436 | static | auto |
| Donderdag Meppeldag | 415 | static | auto |
| Evenementen Grote Maria Kerk Meppel | 400 | static | auto |
| Uitloper Groningen | 300 | static | auto |
| Dot Groningen Events | 261 | static | auto |
| Sense Dokkum Programma | 250 | static | auto |

## Zero-Event Sources Analysis

### 78 Enabled Sources with 0 Events

| Fetcher Type | Count |
|--------------|-------|
| scrapingbee | 63 |
| puppeteer | 15 |

**Root Cause Analysis:**
- All zero-event sources use either scrapingbee or puppeteer fetchers
- Static fetcher sources are working (13,634 events scraped)
- This suggests an issue with the JS-rendering fetchers (API key, configuration, or deployment)

### Sample Zero-Event Sources:
- SC Cambuur Leeuwarden Speelkalender (espn.nl)
- Schouwburg Ogterop Meppel
- SPOT Groningen
- Meppel City Run
- Jazz Dokkum Agenda

## Recommendations

### 1. Enable Waterfall Insights Logging
The waterfall code exists but insights aren't being recorded. Verify:
- Edge functions are properly deployed
- `logScraperInsight()` is being called after each scrape
- No errors are preventing insight logging

### 2. Fix ScrapingBee/Puppeteer Sources
63 scrapingbee + 15 puppeteer sources have 0 events:
- Verify SCRAPINGBEE_API_KEY is set in edge function environment
- Check Puppeteer configuration for JS-heavy sites
- Consider switching non-essential JS-heavy sources to 'static' with enhanced selectors

### 3. Run Full Scraper Test Manually
To collect 300+ new events and see waterfall distribution:

```bash
# Option 1: Deploy and call edge functions
supabase functions deploy scrape-coordinator
supabase functions deploy scrape-worker

curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/scrape-coordinator" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"triggerWorker": true}'

# Option 2: Run local daemon with Deno
deno run --allow-all scripts/scraper-daemon-light.ts
```

### 4. Query Insights After Scraping
```sql
-- Get waterfall strategy distribution
SELECT 
  winning_strategy,
  COUNT(*) as runs,
  SUM(total_events_found) as total_events,
  AVG(execution_time_ms) as avg_time_ms
FROM scraper_insights
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY winning_strategy
ORDER BY total_events DESC;
```

## Analysis Scripts Created

The following scripts were created for scraper analysis:

1. **`scripts/analyze_scraper_distribution.mjs`** - Comprehensive scraper state analysis
2. **`scripts/run_local_scraper_test.mjs`** - Local waterfall testing (requires network access)
3. **`scripts/run_full_scraper_test.mjs`** - Full scraper test with edge function triggering
4. **`scripts/full_scraper_analysis.mjs`** - Detailed source and event distribution analysis

## Conclusion

The LCL scraper has successfully scraped **13,634 events** from 114 sources, all using the 'static' fetcher. The waterfall extraction logic is implemented but:

1. **No distribution data exists** because insights aren't being logged
2. **78 enabled sources (40%) produce 0 events** - all using JS-rendering fetchers
3. **Edge functions may not be deployed** or are misconfigured (returning 400 errors)

To achieve the goal of 300+ new events and waterfall distribution analysis, the edge functions need to be properly deployed and triggered.

---
*Generated by LCL Scraper Test Suite*
