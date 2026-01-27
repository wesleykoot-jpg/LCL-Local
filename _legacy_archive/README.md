# Legacy Scraper Archive

> ⚠️ **DEPRECATED**: This directory contains archived scraper code from the v1 architecture.
> Do NOT import or use any code from this directory in active development.

## Contents

This archive contains the complete scraping infrastructure that was deprecated as part of the
"Scorched Earth" cleanup on 2026-01-27.

### Archived Components

1. **`supabase-functions/`** - Edge Functions for scraping
   - `scrape-coordinator/` - Job orchestration
   - `scrape-events/` - Event extraction
   - `process-worker/` - Pipeline processing
   - `source-discovery-coordinator/` - Source discovery
   - `source-discovery-worker/` - Discovery workers
   - `cleanup-sources/` - Source cleanup
   - `backfill-coordinates/` - Geocoding backfill
   - `_shared/` - Shared utilities (scraperUtils, rateLimiting, etc.)

2. **`scripts/`** - CLI scripts for scraping operations
   - Pipeline triggers
   - Health checks
   - Monitoring tools
   - Database utilities

3. **`types/`** - TypeScript type definitions for scraper

## Why Archived?

The v1 scraper architecture had several issues:
- Mixed implementation patterns across files
- Complex state machines that were hard to debug
- Tightly coupled components
- Database schema sprawl (40+ scraper-related tables/functions)

## Migration Notes

The database cleanup migration (`20260127000000_scorched_earth_scraper_reset.sql`) 
drops all database objects related to this code.

## Restoration

If you need to reference this code for the new architecture:
1. Browse the archived files for patterns/logic
2. Do NOT copy-paste directly - rewrite with new patterns
3. This code should never be re-enabled as-is
