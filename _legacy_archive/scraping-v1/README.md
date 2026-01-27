# Legacy Scraping Architecture v1 - Archive

## Archive Date
2026-01-27

## Purpose
This directory contains the complete legacy scraping implementation that was removed as part of the "Scorched Earth" cleanup to prepare for a new scraping architecture.

## What Was Removed

### Database Objects (via migration `20260127000001_scorched_earth_safe_cleanup.sql`)
- **Tables:**
  - `scraper_sources` - Source configuration
  - `scraper_sources_archive` - Archived sources
  - `scrape_jobs` - Job queue
  - `scrape_events` - Event logs
  - `scraper_failures` - Failure tracking
  - `scraper_runs` - Run history
  - `scraper_insights` - Analytics data
  - `pipeline_jobs` - Pipeline orchestration
  - `raw_pages` - HTML storage checkpoint
  - `raw_events` - Parsed events before normalization
  - `staged_events` - Normalized events before persistence
  - `raw_event_staging` - Staging table
  - `discovery_jobs` - Source discovery jobs
  - `geocode_cache` - Geocoding cache
  - `error_logs`, `dead_letter_queue`, `circuit_breaker_state`, `rate_limits`
  - `embedding_queue`, `enrichment_logs`, `net_http_responses_audit`

- **Types & Enums:**
  - `fetcher_type_enum` - Static, Puppeteer, Playwright, ScrapingBee
  - `scraper.event_category_key` - Event categories
  - `scraper_status`, `pipeline_stage`, `scrape_status`

- **Functions:**
  - `trigger_scrape_coordinator`
  - `update_scraper_source_stats`
  - `get_pipeline_health`
  - `get_scraper_stats`
  - `get_recent_scraper_runs`
  - `reset_stuck_scrape_jobs`
  - `log_scraper_insight`
  - `enqueue_scrape_jobs`
  - `claim_scrape_jobs`
  - `cleanup_old_scrape_jobs`
  - `recover_stuck_scrape_jobs`

- **Schema:**
  - `scraper` schema (entire namespace removed)

### Code Structure

#### `/supabase-functions/`
Edge functions that powered the scraping system:
- `scrape-events/` - Main event scraper with strategy-based discovery
- `scrape-coordinator/` - Orchestration for distributed scraping
- `source-discovery-coordinator/` - Source discovery orchestration
- `source-discovery-worker/` - Worker for discovering new sources
- `process-worker/` - Pipeline processing worker
- Shared utilities: `scraperUtils.ts`, `scraperInsights.ts`, `scraperObservability.ts`

#### `/src-lib/`
Client-side scraping services:
- `scraperService.ts` - Main scraper service API
- `scraperUtils.ts` - Utility functions (rotating headers, user agents)
- `scraperUtils.test.ts` - Unit tests
- Admin scraper service from `src/features/admin/api/`

#### `/scripts/`
Operational and debugging scripts:
- Pipeline execution: `run_pipeline.ts`, `run_processor_only.ts`, `run_process_worker_*.ts`
- Data management: `reset_scraper_data_deno.ts`, `reset_scraper_data.sql`
- Testing: `demo_scrape.ts`, `run-scraper-sample-test.ts`
- Triggers: `trigger_scrape_coordinator.ts/cjs`, `trigger_scrape_events.cjs`
- Maintenance: `clear_scraper_tables.cjs`, `patch_scrape_jobs.cjs`, `recreate_scrape_jobs.cjs`
- Monitoring: `check_scraper_counts.ts`, `check_pipeline_health.ts`, `query_scraper_insights.mjs`
- Analysis: `analyze_raw_events.ts`, `check_stuck_processing.ts`
- Discovery: `run-discovery-blast.ps1`, `apply_discovery_migrations.mjs`
- Benchmarking: `bench_scraper_targets.ts`
- Daemon: `scraper-daemon.ts`

#### `/tests/`
Comprehensive test suite:
- `scraper_config.test.ts` - Configuration tests
- `scraper_unit_test.ts` - Unit tests
- `scraper_sample_harness_test.ts` - Sample harness
- `scraper_e2e_comprehensive_test.ts` - End-to-end tests
- `demo_scrape_test.ts` - Demo scraping tests

#### `/docs/`
Complete documentation set from `docs/scraper/`:
- `RUNBOOK.md` - Operational runbook
- `SCRAPER_ARCHITECTURE.md` - Architecture overview
- `SCRAPER_IMPROVEMENTS.md` - Improvement proposals
- `SCRAPER_PIPELINE_CONTROL.md` - Pipeline control documentation
- `SCRAPER_PIPELINE_CONTROL_UI.md` - UI documentation
- `SCRAPER_INTEGRITY_TESTS.md` - Testing documentation
- `SCRAPER_ADMIN_TROUBLESHOOTING.md` - Troubleshooting guide
- `FETCHER_TYPES.md` - Fetcher type documentation
- `CATEGORY_NORMALIZATION.md` - Category normalization
- `RATE_LIMIT_STATE_TESTING.md` - Rate limiting tests
- `RATE_LIMIT_STATE_UI_VISUAL.md` - Rate limiting UI

## Architecture Overview (Pre-Archive)

### Pipeline Stages
The scraping system used a multi-stage, resilient pipeline:

1. **Fetch Stage**: Download HTML pages with multiple fetcher types
2. **Parse Stage**: Extract event data using strategy-based parsers
3. **Normalize Stage**: Clean and standardize event data
4. **Persist Stage**: Insert into main `events` table with deduplication

### Key Features
- **Strategy-based discovery**: Different strategies for different source types (cinema, sports, music, etc.)
- **Multiple fetchers**: Static, Puppeteer, Playwright, ScrapingBee
- **Defensive scraping**: Robots.txt respect, rate limiting, exponential backoff
- **Observability**: Full logging to `scrape_events` table, Slack alerts
- **Resilience**: Circuit breakers, retry logic, dead letter queue
- **AI-powered extraction**: OpenAI integration for intelligent event parsing
- **Geocoding**: Nominatim API with caching
- **Dutch CMS support**: Specialized handling for Ontdek, Beleef, Visit, Uit platforms

### Data Flow
```
Source Config → Discovery → Fetch → Parse → Normalize → Persist → Events Table
     ↓              ↓         ↓        ↓         ↓          ↓
  scraper_     discovery_  raw_    raw_     staged_    events
  sources        jobs      pages   events    events
```

## Why Was It Removed?

The legacy scraping architecture had accumulated technical debt through:
- Mixed implementations across multiple iterations
- Overlapping concerns between pipeline stages
- Database schema complexity with many intermediate tables
- Inconsistent error handling patterns
- Tightly coupled components
- Difficulty in testing and debugging

## What's Next?

A new scraping architecture will be built from scratch with:
- Cleaner separation of concerns
- Simpler data models
- Modern patterns and best practices
- Better observability and debugging
- Improved maintainability

## How to Reference This Code

If you need to reference the old implementation:

1. **Database migrations** are still in `supabase/migrations/` (search for dates before 2026-01-27)
2. **All code** is preserved in this directory structure
3. **Documentation** is preserved in `docs/scraper/`

## Important Notes

⚠️ **DO NOT RESTORE THIS CODE TO PRODUCTION**

This archive exists for:
- Historical reference
- Learning from past implementations
- Extracting useful patterns for the new architecture
- Emergency recovery if critical functionality is lost

## Migration Applied

Run date: 2026-01-27
Migration file: `supabase/migrations/20260127000001_scorched_earth_safe_cleanup.sql`

This migration:
- Dropped all scraper-related tables
- Removed all scraper-related functions
- Deleted the `scraper` schema
- Cleaned scraper columns from `events` table
- Removed pg_cron jobs for scraping

## Archive Maintainer

GitHub Copilot (Claude Sonnet 4.5)
Task: "Scorched Earth" cleanup for LCL-Local scraping reboot
