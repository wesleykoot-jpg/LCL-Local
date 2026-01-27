# Archived Root-Level Scraper Files

These root-level files should be moved to the legacy archive.

## Files to Move

From repository root:

- `analyze_methods_100.ts`
- `analyze_raw_events.ts`
- `apply_discovery_migrations.mjs`
- `apply_migrations_direct.cjs`
- `check_db_api.cjs`
- `check_db_counts.ts`
- `check_db_direct.cjs`
- `check_db_simple.cjs`
- `check_event_nulls.ts`
- `check_feed_config.ts`
- `check_markers.ts`
- `check_pipeline_health.ts`
- `check_rss_api_sources.ts`
- `check_stuck_processing.ts`
- `check_tables.cjs`
- `demo_scrape.ts`
- `reset_scraper_data_deno.ts`
- `reset_scraper_data.sql`
- `reset_stuck_jobs.ts`
- `run_pipeline.ts`
- `run_process_worker_local.ts`
- `run_process_worker_loop.ts`
- `run_processor_only.ts`
- `run-scraper-sample-test.ts`
- `sample_raw_html.ts`
- `test_direct_sql.cjs`
- `test_noise_filter.ts`
- `test_supabase_connection.ts`
- `test_supabase_improvements.cjs`
- `test_utilities.cjs`
- `test-soccer-categorization.js`
- `verify_join_flow.ts`

### HTML Source Files (test data)
- `meppel_source_ua.html`
- `meppel_source.html`
- `visitzwolle_source.html`
- `visitzwolle_today.html`
- `zwolle_source.html`

## Move Command

```bash
mkdir -p _legacy_archive/root-files

mv analyze_methods_100.ts _legacy_archive/root-files/
mv analyze_raw_events.ts _legacy_archive/root-files/
mv apply_discovery_migrations.mjs _legacy_archive/root-files/
mv apply_migrations_direct.cjs _legacy_archive/root-files/
mv check_db_api.cjs _legacy_archive/root-files/
mv check_db_counts.ts _legacy_archive/root-files/
mv check_db_direct.cjs _legacy_archive/root-files/
mv check_db_simple.cjs _legacy_archive/root-files/
mv check_event_nulls.ts _legacy_archive/root-files/
mv check_feed_config.ts _legacy_archive/root-files/
mv check_markers.ts _legacy_archive/root-files/
mv check_pipeline_health.ts _legacy_archive/root-files/
mv check_rss_api_sources.ts _legacy_archive/root-files/
mv check_stuck_processing.ts _legacy_archive/root-files/
mv check_tables.cjs _legacy_archive/root-files/
mv demo_scrape.ts _legacy_archive/root-files/
mv reset_scraper_data_deno.ts _legacy_archive/root-files/
mv reset_scraper_data.sql _legacy_archive/root-files/
mv reset_stuck_jobs.ts _legacy_archive/root-files/
mv run_pipeline.ts _legacy_archive/root-files/
mv run_process_worker_local.ts _legacy_archive/root-files/
mv run_process_worker_loop.ts _legacy_archive/root-files/
mv run_processor_only.ts _legacy_archive/root-files/
mv run-scraper-sample-test.ts _legacy_archive/root-files/
mv sample_raw_html.ts _legacy_archive/root-files/
mv test_direct_sql.cjs _legacy_archive/root-files/
mv test_noise_filter.ts _legacy_archive/root-files/
mv test_supabase_connection.ts _legacy_archive/root-files/
mv test_supabase_improvements.cjs _legacy_archive/root-files/
mv test_utilities.cjs _legacy_archive/root-files/
mv test-soccer-categorization.js _legacy_archive/root-files/
mv verify_join_flow.ts _legacy_archive/root-files/
mv meppel_source_ua.html _legacy_archive/root-files/
mv meppel_source.html _legacy_archive/root-files/
mv visitzwolle_source.html _legacy_archive/root-files/
mv visitzwolle_today.html _legacy_archive/root-files/
mv zwolle_source.html _legacy_archive/root-files/
```
