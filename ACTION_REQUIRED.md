# 🚀 Waterfall Intelligence Test - Action Required

## Current Status

✅ **Implementation Complete** - All code and scripts are ready  
❌ **Migration Not Applied** - The `scraper_insights` table does not exist in the database yet  
⏸️ **Test Blocked** - Cannot run full test until migration is applied  

## What You Need to Do Now

### 1. Apply the Migration (5 minutes)

The scraper_insights table must be created before the waterfall intelligence can track extraction methods.

#### Quick Copy Method

```bash
# This will display the SQL - copy and paste into Supabase Dashboard
bash scripts/show_migration_sql.sh
```

Then:
1. Open Supabase SQL Editor: https://mlpefjsbriqgxcaqxhic.supabase.co/project/_/sql
2. Paste the SQL from the output above
3. Click "Run" to execute

**OR** manually open and copy:
- File: `supabase/migrations/20260121000000_data_first_pipeline.sql`
- Paste into Supabase SQL Editor and run

### 2. Verify Migration Applied

```bash
node check_tables.cjs
```

You should see:
```
✅ scraper_sources
✅ scraper_insights    ← This should now show ✅
✅ events
✅ scraper_runs
✅ scrape_jobs
```

### 3. Run the Full Test

```bash
node scripts/run_full_waterfall_test.mjs
```

This will:
- ✅ Verify the table exists
- 🚀 Trigger the scraper coordinator
- ⏳ Wait 30 seconds for scraping
- 📊 Display extraction method distribution

Expected output:
```
╔══════════════════════════════════════════════════════════════╗
║        LCL WATERFALL INTELLIGENCE FULL TEST RUNNER          ║
╚══════════════════════════════════════════════════════════════╝

🔍 Step 1: Checking if scraper_insights table exists...
✅ scraper_insights table exists!

🚀 Step 2: Triggering scrape coordinator...
✅ Scraper triggered successfully!

⏳ Step 3: Waiting for scraper to complete (30 seconds)...

📊 Step 4: Querying scraper insights...

1️⃣  EXTRACTION METHOD DISTRIBUTION:

Method          | Runs | Events | Success | Avg Time (ms)
─────────────────────────────────────────────────────────────
json_ld         | 15   | 234    | 15      | 1234
dom             | 12   | 89     | 10      | 2345
hydration       | 8    | 156    | 8       | 890
feed            | 5    | 45     | 5       | 1567
```

## What This Tests

The waterfall intelligence system uses a 4-tier extraction strategy:

1. **HYDRATION** (Priority 1) - Next.js/React state objects
   - Highest fidelity structured data
   - Best for: Next.js, Nuxt, React, Wix sites

2. **JSON-LD** (Priority 2) - Schema.org structured data
   - High fidelity semantic data
   - Best for: WordPress, Squarespace sites

3. **FEED** (Priority 3) - RSS/Atom/ICS feeds
   - Medium fidelity event feeds
   - Best for: Municipal calendars, libraries

4. **DOM** (Priority 4) - CSS selector extraction
   - Fallback for custom HTML
   - Configurable per source

The system automatically tracks which method works best for each source and optimizes over time.

## Additional Commands

After the scraper runs, query insights anytime:
```bash
# Query current insights without re-running scraper
node scripts/query_scraper_insights.mjs
```

Check what tables exist:
```bash
node check_tables.cjs
```

## Documentation

- **Full Guide**: `WATERFALL_TEST_GUIDE.md` - Complete testing instructions
- **Implementation Report**: `WATERFALL_INTELLIGENCE_REPORT.md` - Architecture details
- **Migration File**: `supabase/migrations/20260121000000_data_first_pipeline.sql`

## Troubleshooting

**"scraper_insights table NOT found"**
→ Migration hasn't been applied yet. Follow step 1 above.

**"No insights found yet"**
→ Scraper hasn't run or is still running. Wait longer or check Supabase Functions logs.

**Scraper not triggering**
→ Check .env file has correct SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

---

## Summary

🎯 **Next Action**: Apply the migration via Supabase Dashboard (step 1)  
⏱️ **Time Required**: ~5 minutes to apply migration + 1 minute to run test  
✅ **Expected Result**: See which extraction methods are used across your sources  

Once you've applied the migration, just run:
```bash
node scripts/run_full_waterfall_test.mjs
```

And you'll see the complete distribution of extraction methods being used! 🎉
