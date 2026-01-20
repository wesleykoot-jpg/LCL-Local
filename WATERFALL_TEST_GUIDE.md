# Waterfall Intelligence Full Test Guide

This guide explains how to run the full test of the LCL scraper's waterfall intelligence system.

## Prerequisites

The `scraper_insights` table must exist in your database. This table tracks which extraction methods (hydration, JSON-LD, feed, DOM) are used for each scrape.

### Check if Migration is Applied

```bash
node check_tables.cjs
```

Look for:
- ✅ `scraper_insights` - Migration applied, ready to test
- ❌ `scraper_insights` - Migration needed (see below)

## Step 1: Apply the Migration (If Needed)

The migration file is: `supabase/migrations/20260121000000_data_first_pipeline.sql`

### Option A: Using Supabase Dashboard (Recommended)

1. Open the Supabase SQL Editor:
   - URL: https://mlpefjsbriqgxcaqxhic.supabase.co/project/_/sql
   - Or: Dashboard → SQL Editor

2. Copy the entire contents of `supabase/migrations/20260121000000_data_first_pipeline.sql`

3. Paste into the SQL Editor

4. Click "Run" to execute

5. Verify by running `node check_tables.cjs` - you should see ✅ for `scraper_insights`

### Option B: Using Supabase CLI (If Installed)

```bash
# Make sure you're in the project directory
cd /path/to/LCL-Local

# Push the migration
supabase db push
```

## Step 2: Run the Full Test

Once the migration is applied, run the comprehensive test:

```bash
node scripts/run_full_waterfall_test.mjs
```

This script will:
1. ✅ Verify the `scraper_insights` table exists
2. 🚀 Trigger the scrape coordinator
3. ⏳ Wait 30 seconds for scraping to complete
4. 📊 Query and display the results

### Expected Output

```
╔══════════════════════════════════════════════════════════════╗
║        LCL WATERFALL INTELLIGENCE FULL TEST RUNNER          ║
╚══════════════════════════════════════════════════════════════╝

🔍 Step 1: Checking if scraper_insights table exists...
✅ scraper_insights table exists!

🚀 Step 2: Triggering scrape coordinator...
Response Status: 200
✅ Scraper triggered successfully!

⏳ Step 3: Waiting for scraper to complete (30 seconds)...
..............................

📊 Step 4: Querying scraper insights...

1️⃣  EXTRACTION METHOD DISTRIBUTION:

Method          | Runs | Events | Success | Avg Time (ms)
─────────────────────────────────────────────────────────────
json_ld         | 15   | 234    | 15      | 1234
dom             | 12   | 89     | 10      | 2345
hydration       | 8    | 156    | 8       | 890
feed            | 5    | 45     | 5       | 1567

2️⃣  RECENT SCRAPER RUNS (Last 10):
...

3️⃣  OVERALL SUMMARY:
Total Scraper Runs: 40
Total Events Found: 524
Successful Runs: 38 (95%)
Failed Runs: 2
```

## Step 3: Query Insights Anytime

After the scraper has run, you can query insights anytime without re-running the scraper:

```bash
node scripts/query_scraper_insights.mjs
```

This displays:
- Extraction method distribution
- Recent scraper runs (last 20)
- Overall summary statistics
- CMS/Framework detection results

## Advanced SQL Queries

See `WATERFALL_INTELLIGENCE_REPORT.md` for advanced SQL queries you can run in the Supabase SQL Editor:

```sql
-- Get extraction method summary
SELECT 
  winning_strategy,
  COUNT(*) as runs,
  SUM(total_events_found) as total_events,
  AVG(execution_time_ms) as avg_time_ms
FROM scraper_insights
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY winning_strategy
ORDER BY total_events DESC;

-- Get per-source strategy performance
SELECT 
  s.name,
  i.winning_strategy,
  i.total_events_found,
  i.status,
  i.detected_cms
FROM scraper_insights i
JOIN scraper_sources s ON s.id = i.source_id
ORDER BY i.created_at DESC
LIMIT 50;
```

## Troubleshooting

### "scraper_insights table NOT found"

The migration hasn't been applied yet. Follow Step 1 above.

### "No insights found yet"

The scraper hasn't run yet, or it's still running. Either:
- Wait a bit longer and query again
- Check if there are any errors in the Supabase Functions logs
- Manually trigger the scraper again

### Scraper not triggering

Check:
1. Supabase URL is correct in `.env`
2. Service role key is valid in `.env`
3. The `scrape-coordinator` Edge Function is deployed
4. Check Supabase Functions logs for errors

## What This Tests

The waterfall intelligence system implements a 4-tier extraction strategy:

1. **Hydration** (Priority 1): Extract from Next.js/React state objects
   - Highest fidelity, structured data
   - Works with: Next.js, Nuxt, React, Wix

2. **JSON-LD** (Priority 2): Parse Schema.org structured data
   - High fidelity semantic data
   - Works with: WordPress, Squarespace

3. **Feed** (Priority 3): Parse RSS/Atom/ICS feeds
   - Medium fidelity event feeds
   - Works with: Municipal sites, libraries

4. **DOM** (Priority 4): CSS selector-based extraction
   - Fallback for custom HTML sites
   - Configurable selectors per source

## Next Steps

After running the test successfully:

1. Review the distribution of extraction methods
2. Check which methods are most effective for your sources
3. The system auto-optimizes: after 3 consistent successes with the same method, it automatically updates the source's `preferred_method`
4. Monitor the `source_health_with_insights` view for ongoing performance

## Documentation

- **Architecture**: See `WATERFALL_INTELLIGENCE_REPORT.md`
- **Implementation**: See `supabase/functions/_shared/dataExtractors.ts`
- **Database Schema**: See `supabase/migrations/20260121000000_data_first_pipeline.sql`
