# Archived Scraper Scripts

This directory should contain archived CLI scripts for scraping operations.

## Scripts to Move Here

From `scripts/`:

### Core Pipeline Scripts
- `scraper-daemon.ts`
- `trigger_coordinator.ts`
- `trigger_coordinator.mjs`
- `trigger_pipeline.ts`
- `trigger_scrape_coordinator.ts`
- `trigger_scrape_coordinator.cjs`
- `trigger_scrape_events.cjs`
- `trigger_zwolle_meppel.ts`

### Runner Scripts
- `run_10_city_pipeline.ts`
- `run_fetcher_local.ts`
- `run_pilot_driver_local.ts`
- `run_process_worker_safe.ts`
- `run_smart_selectors.ts`
- `run_worker_local.ts`
- `run_zwolle_meppel_live.ts`
- `run_zwolle_meppel_local.ts`
- `run_zwolle_meppel_pipeline.ts`
- `run-elt-migration.ts`
- `run-e2e-scraper-test.sh`
- `run-scraper-dryrun.sh`

### Health Check Scripts
- `health_check.ts`
- `health_check_coordinator.ts`
- `health_check_fetcher.ts`
- `health_check_worker.ts`

### Diagnostic Scripts
- `diagnose_automation.ts`
- `diagnose_pipeline.ts`
- `inspect_errors.ts`
- `inspect_jobs.ts`
- `analyze_failures.ts`
- `analyze_job_event_discrepancy.ts`
- `analyze_quality.cjs`

### Database/Pipeline Utilities
- `clear_scraper_tables.cjs`
- `patch_scrape_jobs.cjs`
- `recreate_scrape_jobs.cjs`
- `reset_staging.cjs`
- `reset_stuck_jobs.ts`
- `recover_jobs.ts`
- `drain_queue.ts`
- `apply_claim_rpc.cjs`
- `apply_proxy_fix.ts`
- `autofix_pipeline.ts`

### Monitoring Scripts
- `monitor_live_demo.ts`
- `monitor_scraping.cjs`
- `stats_per_source.cjs`
- `check_scraper_counts.ts`
- `query_scraper_insights.mjs`
- `dump-insights.ts`

### Verification Scripts
- `verify-async-rss.ts`
- `verify-elt-pipeline.ts`
- `verify-healing.cjs`

### Setup Scripts
- `setup_dutch_pilot.ts`
- `setup_scheduler.cjs`
- `seed-dutch-cities.ts`
- `force_venlo_local_discovery.ts`
- `force_reset_schedule.ts`
- `shutdown_pilot.ts`

### Benchmarking
- `bench_scraper_targets.ts`
- `benchmark_100_sources.ts`

### Misc Utilities
- `cleanup_bad_data.cjs`
- `fetch_recent_errors.ts`
- `list_top_sources.ts`
- `migrate_tags.ts`
- `simple_reset.ts`
- `start_daemon.sh`
- `summarize_extraction.cjs`

## Move Command

Run from repository root:

```bash
mkdir -p _legacy_archive/scripts

# Move all scraper-related scripts
mv scripts/scraper-daemon.ts _legacy_archive/scripts/
mv scripts/trigger_coordinator.ts _legacy_archive/scripts/
mv scripts/trigger_coordinator.mjs _legacy_archive/scripts/
mv scripts/trigger_pipeline.ts _legacy_archive/scripts/
mv scripts/trigger_scrape_coordinator.ts _legacy_archive/scripts/
mv scripts/trigger_scrape_coordinator.cjs _legacy_archive/scripts/
mv scripts/trigger_scrape_events.cjs _legacy_archive/scripts/
mv scripts/trigger_zwolle_meppel.ts _legacy_archive/scripts/
mv scripts/run_10_city_pipeline.ts _legacy_archive/scripts/
mv scripts/run_fetcher_local.ts _legacy_archive/scripts/
mv scripts/run_pilot_driver_local.ts _legacy_archive/scripts/
mv scripts/run_process_worker_safe.ts _legacy_archive/scripts/
mv scripts/run_smart_selectors.ts _legacy_archive/scripts/
mv scripts/run_worker_local.ts _legacy_archive/scripts/
mv scripts/run_zwolle_meppel_live.ts _legacy_archive/scripts/
mv scripts/run_zwolle_meppel_local.ts _legacy_archive/scripts/
mv scripts/run_zwolle_meppel_pipeline.ts _legacy_archive/scripts/
mv scripts/run-elt-migration.ts _legacy_archive/scripts/
mv scripts/run-e2e-scraper-test.sh _legacy_archive/scripts/
mv scripts/run-scraper-dryrun.sh _legacy_archive/scripts/
mv scripts/health_check.ts _legacy_archive/scripts/
mv scripts/health_check_coordinator.ts _legacy_archive/scripts/
mv scripts/health_check_fetcher.ts _legacy_archive/scripts/
mv scripts/health_check_worker.ts _legacy_archive/scripts/
mv scripts/diagnose_automation.ts _legacy_archive/scripts/
mv scripts/diagnose_pipeline.ts _legacy_archive/scripts/
mv scripts/inspect_errors.ts _legacy_archive/scripts/
mv scripts/inspect_jobs.ts _legacy_archive/scripts/
mv scripts/analyze_failures.ts _legacy_archive/scripts/
mv scripts/analyze_job_event_discrepancy.ts _legacy_archive/scripts/
mv scripts/analyze_quality.cjs _legacy_archive/scripts/
mv scripts/clear_scraper_tables.cjs _legacy_archive/scripts/
mv scripts/patch_scrape_jobs.cjs _legacy_archive/scripts/
mv scripts/recreate_scrape_jobs.cjs _legacy_archive/scripts/
mv scripts/reset_staging.cjs _legacy_archive/scripts/
mv scripts/reset_stuck_jobs.ts _legacy_archive/scripts/
mv scripts/recover_jobs.ts _legacy_archive/scripts/
mv scripts/drain_queue.ts _legacy_archive/scripts/
mv scripts/apply_claim_rpc.cjs _legacy_archive/scripts/
mv scripts/apply_proxy_fix.ts _legacy_archive/scripts/
mv scripts/autofix_pipeline.ts _legacy_archive/scripts/
mv scripts/monitor_live_demo.ts _legacy_archive/scripts/
mv scripts/monitor_scraping.cjs _legacy_archive/scripts/
mv scripts/stats_per_source.cjs _legacy_archive/scripts/
mv scripts/check_scraper_counts.ts _legacy_archive/scripts/
mv scripts/query_scraper_insights.mjs _legacy_archive/scripts/
mv scripts/dump-insights.ts _legacy_archive/scripts/
mv scripts/verify-async-rss.ts _legacy_archive/scripts/
mv scripts/verify-elt-pipeline.ts _legacy_archive/scripts/
mv scripts/verify-healing.cjs _legacy_archive/scripts/
mv scripts/setup_dutch_pilot.ts _legacy_archive/scripts/
mv scripts/setup_scheduler.cjs _legacy_archive/scripts/
mv scripts/seed-dutch-cities.ts _legacy_archive/scripts/
mv scripts/force_venlo_local_discovery.ts _legacy_archive/scripts/
mv scripts/force_reset_schedule.ts _legacy_archive/scripts/
mv scripts/shutdown_pilot.ts _legacy_archive/scripts/
mv scripts/bench_scraper_targets.ts _legacy_archive/scripts/
mv scripts/benchmark_100_sources.ts _legacy_archive/scripts/
mv scripts/cleanup_bad_data.cjs _legacy_archive/scripts/
mv scripts/fetch_recent_errors.ts _legacy_archive/scripts/
mv scripts/list_top_sources.ts _legacy_archive/scripts/
mv scripts/migrate_tags.ts _legacy_archive/scripts/
mv scripts/simple_reset.ts _legacy_archive/scripts/
mv scripts/start_daemon.sh _legacy_archive/scripts/
mv scripts/summarize_extraction.cjs _legacy_archive/scripts/

# Also move the legacy subdirectory
mv scripts/legacy _legacy_archive/scripts/
```
