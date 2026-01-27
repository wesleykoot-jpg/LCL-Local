# Scorched Earth Cleanup - Post-Migration Tasks

## Completed ✓

1. **Database Migration Created**: [20260127000001_scorched_earth_safe_cleanup.sql](vscode-vfs://github/wesleykoot-jpg/LCL-Local/supabase/migrations/20260127000001_scorched_earth_safe_cleanup.sql)
   - Drops all scraper/pipeline tables
   - Removes scraper-related functions
   - Deletes `scraper` schema
   - Cleans types and enums
   - Includes verification checks

2. **Code Archived**: All scraping code moved to `_legacy_archive/scraping-v1/`
   - Supabase edge functions (scrape-events, scrape-coordinator, workers, etc.)
   - Source utilities (scraperService.ts, scraperUtils.ts)
   - Test files
   - Scripts (40+ operational scripts)
   - Documentation (complete docs/scraper/ folder)

3. **Build Fixed**: Removed broken imports from:
   - `src/components/DevPanel.tsx`
   - `src/features/admin/Admin.tsx`
   - `src/features/admin/index.ts`

## Required: Run Migration

**You must now run the migration to clean the database:**

```bash
cd ~/Documents/LCL-Local
set -a && source .env.local && set +a
/usr/local/opt/libpq/bin/psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260127000001_scorched_earth_safe_cleanup.sql
```

Or if using Supabase CLI:
```bash
supabase db reset  # Will apply all migrations including the cleanup
```

## After Migration Runs

### 1. Regenerate TypeScript Types

The current `src/integrations/supabase/types.ts` still contains references to removed tables. After running the migration:

```bash
# If using Supabase CLI
supabase gen types typescript --local > src/integrations/supabase/types.ts

# Or with remote DB
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

### 2. Verify Database is Clean

Run this query to confirm all scraper artifacts are gone:

```sql
-- Tables
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema NOT IN ('pg_catalog','information_schema') 
  AND (table_name ILIKE '%scrap%' OR table_name ILIKE '%pipeline%' OR table_name ILIKE '%scraper%');

-- Functions
SELECT routine_schema, routine_name
FROM information_schema.routines
WHERE routine_schema NOT IN ('pg_catalog', 'information_schema')
  AND (routine_name ILIKE '%scrap%' OR routine_name ILIKE '%pipeline%' OR routine_name ILIKE '%scraper%');

-- Schemas
SELECT nspname 
FROM pg_namespace 
WHERE nspname ILIKE '%scrap%' OR nspname ILIKE '%pipeline%' OR nspname ILIKE '%scraper%';
```

Expected result: **0 rows** for all three queries.

### 3. Clean Up Config Files (Optional)

These files may contain scraper-related configuration:
- `supabase/config.toml` - Check for scraper function definitions
- `supabase/seed_scraper_config.sql` - No longer needed
- `.env.local` - Remove scraper-related environment variables (OPENAI_API_KEY if only used for scraping)

### 4. Remove Seed Data (Optional)

```bash
cd ~/Documents/LCL-Local
rm -f supabase/seed_scraper_config.sql  # No longer needed
```

## What Was Removed

### Database Objects
- 25+ tables (scraper_sources, raw_events, staged_events, pipeline_jobs, etc.)
- 10+ functions (trigger_scrape_coordinator, update_scraper_source_stats, etc.)
- 3+ types/enums (fetcher_type_enum, scraper.event_category_key, etc.)
- `scraper` schema (entire namespace)

### Code Files
- 5 Supabase edge functions
- 3 shared utility modules
- 40+ operational scripts
- 5 test suites
- 10+ documentation files

See [_legacy_archive/scraping-v1/README.md](vscode-vfs://github/wesleykoot-jpg/LCL-Local/_legacy_archive/scraping-v1/README.md) for complete details.

## Status

- ✅ Migration created
- ✅ Code archived
- ✅ Build fixed
- ⏳ **Migration not yet run** (awaiting your execution)
- ⏳ TypeScript types not yet regenerated

## Next Steps

1. **Run the migration** (see command above)
2. **Regenerate types** (see command above)
3. **Verify cleanup** (run verification queries)
4. Start building the new scraping architecture from zero!

---

**Archive Location**: `_legacy_archive/scraping-v1/`  
**Migration File**: `supabase/migrations/20260127000001_scorched_earth_safe_cleanup.sql`  
**Cleanup Date**: 2026-01-27
