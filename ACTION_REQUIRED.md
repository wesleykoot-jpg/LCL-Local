# 🚀 Waterfall Intelligence (SG) - Action Required

## Current Status

✅ **Implementation Complete** - SG pipeline + Waterfall V2 modules are ready  
❌ **Migration Not Applied** - SG schema migration must be applied  
⏸️ **Test Blocked** - Cannot run full pipeline until SG schema exists  

## What You Need to Do Now

### 1. Apply the SG Schema Migration (5 minutes)

Apply:

- `supabase/migrations/20260128100000_disable_legacy_pipeline_and_create_social_graph_schema.sql`

This creates:
- `sg_sources`
- `sg_pipeline_queue`
- `sg_pipeline_metrics`, `sg_failure_log`, `sg_ai_repair_log`

### 2. Verify Migration Applied

Check the SG tables exist in the database.

### 3. Run the Full Pipeline

Use `sg-orchestrator` with mode `run_all` to execute Scout → Strategist → Curator → Vectorizer.

Expected result:
- `sg_pipeline_queue` progresses to `indexed`
- New rows appear in `events`

## What This Tests

The Waterfall Intelligence (SG) pipeline:

1. **Scout** - Discover sources and seed URLs
2. **Strategist** - Decide fetch strategy
3. **Curator** - Fetch, extract Social Five, enrich, dedupe
4. **Vectorizer** - Embeddings + persist to `events`

## Documentation

- **Implementation Report**: `WATERFALL_INTELLIGENCE_REPORT.md`
- **Scraper Architecture**: `docs/scraper/SCRAPER_ARCHITECTURE.md`
- **Migration File**: `supabase/migrations/20260128100000_disable_legacy_pipeline_and_create_social_graph_schema.sql`

---

## Summary

🎯 **Next Action**: Apply the SG schema migration  
✅ **Expected Result**: SG pipeline stages advance and new events appear in `events`
