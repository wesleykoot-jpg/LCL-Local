#!/bin/bash
# =============================================================================
# SCORCHED EARTH: Move Legacy Scraper Code to Archive
# =============================================================================
# This script moves all scraper-related code to _legacy_archive/
# Run from repository root: bash _legacy_archive/move_to_archive.sh
# =============================================================================

set -e  # Exit on error

echo "🔥 SCORCHED EARTH: Moving legacy scraper code to archive..."
echo ""

# Create archive directories
echo "📁 Creating archive directory structure..."
mkdir -p _legacy_archive/supabase-functions/_shared
mkdir -p _legacy_archive/scripts/legacy
mkdir -p _legacy_archive/scripts/lib
mkdir -p _legacy_archive/root-files
mkdir -p _legacy_archive/docs

# =============================================================================
# PHASE 1: Move Supabase Edge Functions
# =============================================================================
echo ""
echo "📦 Phase 1: Moving Supabase Edge Functions..."

# Scraper Edge Functions
for fn in scrape-coordinator scrape-events process-worker source-discovery-coordinator source-discovery-worker cleanup-sources backfill-coordinates; do
  if [ -d "supabase/functions/$fn" ]; then
    mv "supabase/functions/$fn" "_legacy_archive/supabase-functions/"
    echo "  ✓ Moved $fn"
  fi
done

# Shared scraper utilities
SHARED_FILES=(
  aiParsing.ts
  categorizer.ts
  categoryMapping.ts
  circuitBreaker.ts
  cmsFingerprinter.ts
  dataExtractors.ts
  dateUtils.ts
  dlq.ts
  dutchMunicipalities.ts
  enrichment.ts
  jsonLdParser.ts
  rateLimitParsing.ts
  rateLimiting.ts
  scraperInsights.ts
  scraperObservability.ts
  scraperUtils.ts
  serverRateLimiting.ts
  slack.ts
  strategies.ts
)

for file in "${SHARED_FILES[@]}"; do
  if [ -f "supabase/functions/_shared/$file" ]; then
    mv "supabase/functions/_shared/$file" "_legacy_archive/supabase-functions/_shared/"
    echo "  ✓ Moved _shared/$file"
  fi
done

# =============================================================================
# PHASE 2: Move Scripts
# =============================================================================
echo ""
echo "📦 Phase 2: Moving scripts..."

SCRIPT_FILES=(
  # Daemon and triggers
  scraper-daemon.ts
  trigger_coordinator.ts
  trigger_coordinator.mjs
  trigger_pipeline.ts
  trigger_scrape_coordinator.ts
  trigger_scrape_coordinator.cjs
  trigger_scrape_events.cjs
  trigger_zwolle_meppel.ts
  
  # Runners
  run_10_city_pipeline.ts
  run_fetcher_local.ts
  run_pilot_driver_local.ts
  run_process_worker_safe.ts
  run_smart_selectors.ts
  run_worker_local.ts
  run_zwolle_meppel_live.ts
  run_zwolle_meppel_local.ts
  run_zwolle_meppel_pipeline.ts
  run-elt-migration.ts
  run-e2e-scraper-test.sh
  run-scraper-dryrun.sh
  
  # Health checks
  health_check.ts
  health_check_coordinator.ts
  health_check_fetcher.ts
  health_check_worker.ts
  
  # Diagnostics
  diagnose_automation.ts
  diagnose_pipeline.ts
  inspect_errors.ts
  inspect_jobs.ts
  analyze_failures.ts
  analyze_job_event_discrepancy.ts
  analyze_quality.cjs
  
  # Database utilities
  clear_scraper_tables.cjs
  patch_scrape_jobs.cjs
  recreate_scrape_jobs.cjs
  reset_staging.cjs
  reset_stuck_jobs.ts
  recover_jobs.ts
  drain_queue.ts
  apply_claim_rpc.cjs
  apply_proxy_fix.ts
  autofix_pipeline.ts
  
  # Monitoring
  monitor_live_demo.ts
  monitor_scraping.cjs
  stats_per_source.cjs
  check_scraper_counts.ts
  query_scraper_insights.mjs
  dump-insights.ts
  
  # Verification
  verify-async-rss.ts
  verify-elt-pipeline.ts
  verify-healing.cjs
  
  # Setup
  setup_dutch_pilot.ts
  setup_scheduler.cjs
  seed-dutch-cities.ts
  force_venlo_local_discovery.ts
  force_reset_schedule.ts
  shutdown_pilot.ts
  
  # Benchmarks
  bench_scraper_targets.ts
  benchmark_100_sources.ts
  
  # Misc
  cleanup_bad_data.cjs
  fetch_recent_errors.ts
  list_top_sources.ts
  migrate_tags.ts
  simple_reset.ts
  start_daemon.sh
  summarize_extraction.cjs
  invoke-backfill.js
)

for file in "${SCRIPT_FILES[@]}"; do
  if [ -f "scripts/$file" ]; then
    mv "scripts/$file" "_legacy_archive/scripts/"
    echo "  ✓ Moved scripts/$file"
  fi
done

# Move legacy and lib subdirectories
if [ -d "scripts/legacy" ]; then
  mv scripts/legacy/* "_legacy_archive/scripts/legacy/" 2>/dev/null || true
  rmdir scripts/legacy 2>/dev/null || true
  echo "  ✓ Moved scripts/legacy/"
fi

if [ -d "scripts/lib" ]; then
  mv scripts/lib/* "_legacy_archive/scripts/lib/" 2>/dev/null || true
  rmdir scripts/lib 2>/dev/null || true
  echo "  ✓ Moved scripts/lib/"
fi

# =============================================================================
# PHASE 3: Move Root-Level Files
# =============================================================================
echo ""
echo "📦 Phase 3: Moving root-level files..."

ROOT_FILES=(
  analyze_methods_100.ts
  analyze_raw_events.ts
  apply_discovery_migrations.mjs
  apply_migrations_direct.cjs
  check_db_api.cjs
  check_db_counts.ts
  check_db_direct.cjs
  check_db_simple.cjs
  check_event_nulls.ts
  check_feed_config.ts
  check_markers.ts
  check_pipeline_health.ts
  check_rss_api_sources.ts
  check_stuck_processing.ts
  check_tables.cjs
  demo_scrape.ts
  reset_scraper_data_deno.ts
  reset_scraper_data.sql
  reset_stuck_jobs.ts
  run_pipeline.ts
  run_process_worker_local.ts
  run_process_worker_loop.ts
  run_processor_only.ts
  run-scraper-sample-test.ts
  sample_raw_html.ts
  test_direct_sql.cjs
  test_noise_filter.ts
  test_supabase_connection.ts
  test_supabase_improvements.cjs
  test_utilities.cjs
  test-soccer-categorization.js
  verify_join_flow.ts
  # HTML test files
  meppel_source_ua.html
  meppel_source.html
  visitzwolle_source.html
  visitzwolle_today.html
  zwolle_source.html
)

for file in "${ROOT_FILES[@]}"; do
  if [ -f "$file" ]; then
    mv "$file" "_legacy_archive/root-files/"
    echo "  ✓ Moved $file"
  fi
done

# =============================================================================
# PHASE 4: Move Documentation
# =============================================================================
echo ""
echo "📦 Phase 4: Moving scraper documentation..."

DOC_FILES=(
  SCRAPER_FIXES_SUMMARY.md
  SCRAPER_PIPELINE_ANALYSIS.md
  WATERFALL_INTELLIGENCE_REPORT.md
  WATERFALL_TEST_GUIDE.md
)

for file in "${DOC_FILES[@]}"; do
  if [ -f "$file" ]; then
    mv "$file" "_legacy_archive/docs/"
    echo "  ✓ Moved $file"
  fi
done

# Move docs/scraper if it exists
if [ -d "docs/scraper" ]; then
  mv docs/scraper "_legacy_archive/docs/"
  echo "  ✓ Moved docs/scraper/"
fi

# =============================================================================
# CLEANUP
# =============================================================================
echo ""
echo "🧹 Cleanup..."

# Remove empty directories
find scripts -type d -empty -delete 2>/dev/null || true

echo ""
echo "✅ SCORCHED EARTH complete!"
echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Run the database migration in Supabase"
echo "  3. Commit: git add -A && git commit -m 'chore: scorched earth - archive legacy scraper'"
echo "  4. Push: git push"
