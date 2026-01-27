-- =============================================================================
-- SCORCHED EARTH: Complete Scraper Architecture Reset (Simple Version)
-- =============================================================================
-- Direct DROP statements without transactions for maximum compatibility
-- =============================================================================

-- Phase 1: Drop ALL Views (CASCADE will handle dependencies)
DROP VIEW IF EXISTS source_health_status CASCADE;
DROP VIEW IF EXISTS pipeline_dashboard CASCADE;
DROP VIEW IF EXISTS scraper_health_dashboard CASCADE;

-- Phase 2: Drop ALL Functions (CASCADE will handle dependencies)
DROP FUNCTION IF EXISTS public.add_scraper_source CASCADE;
DROP FUNCTION IF EXISTS public.toggle_scraper_source CASCADE;
DROP FUNCTION IF EXISTS public.update_scraper_source_stats CASCADE;
DROP FUNCTION IF EXISTS public.update_scraper_source_probe CASCADE;
DROP FUNCTION IF EXISTS public.compute_scraper_reliability CASCADE;
DROP FUNCTION IF EXISTS public.refresh_all_scraper_reliabilities CASCADE;
DROP FUNCTION IF EXISTS public.get_scraper_stats CASCADE;
DROP FUNCTION IF EXISTS public.get_recent_scraper_runs CASCADE;
DROP FUNCTION IF EXISTS public.update_source_preferred_method CASCADE;
DROP FUNCTION IF EXISTS public.log_scraper_insight CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.claim_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.recover_stuck_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.reset_stuck_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.reset_stuck_discovery_jobs CASCADE;
DROP FUNCTION IF EXISTS public.claim_staging_rows CASCADE;
DROP FUNCTION IF EXISTS public.increase_source_rate_limit CASCADE;
DROP FUNCTION IF EXISTS public.reset_expired_rate_limits CASCADE;
DROP FUNCTION IF EXISTS public.get_effective_rate_limit CASCADE;
DROP FUNCTION IF EXISTS public.rate_limit_check CASCADE;
DROP FUNCTION IF EXISTS public.rate_limit_record CASCADE;
DROP FUNCTION IF EXISTS public.cb_record_success CASCADE;
DROP FUNCTION IF EXISTS public.cb_record_failure CASCADE;
DROP FUNCTION IF EXISTS public.cb_check_cooldown CASCADE;
DROP FUNCTION IF EXISTS public.dlq_add CASCADE;
DROP FUNCTION IF EXISTS public.dlq_get_ready_for_retry CASCADE;
DROP FUNCTION IF EXISTS public.dlq_mark_retrying CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_pipeline_data CASCADE;
DROP FUNCTION IF EXISTS public.get_queue_metrics CASCADE;
DROP FUNCTION IF EXISTS public.get_pipeline_health CASCADE;
DROP FUNCTION IF EXISTS public.reset_stale_processing_rows CASCADE;
DROP FUNCTION IF EXISTS public.set_processing_timestamp CASCADE;
DROP FUNCTION IF EXISTS public.update_raw_event_timestamp CASCADE;
DROP FUNCTION IF EXISTS public.check_and_heal_fetcher CASCADE;
DROP FUNCTION IF EXISTS public.reset_auto_disabled_on_enable CASCADE;
DROP FUNCTION IF EXISTS public.apply_exponential_backoff CASCADE;
DROP FUNCTION IF EXISTS public.queue_embedding_generation CASCADE;
DROP FUNCTION IF EXISTS public.get_pending_embedding_jobs CASCADE;
DROP FUNCTION IF EXISTS public.complete_embedding_job CASCADE;
DROP FUNCTION IF EXISTS public.fail_embedding_job CASCADE;
DROP FUNCTION IF EXISTS public.trigger_scrape_coordinator CASCADE;
DROP FUNCTION IF EXISTS public.invoke_edge_function CASCADE;
DROP FUNCTION IF EXISTS public.poll_net_http_responses_audit CASCADE;
DROP FUNCTION IF EXISTS public.update_scrape_state_updated_at CASCADE;
DROP FUNCTION IF EXISTS public.get_source_historical_event_count CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_error_logs CASCADE;
DROP FUNCTION IF EXISTS public.get_events_needing_geocoding CASCADE;

-- Phase 3: Drop ALL Tables (CASCADE will handle all dependencies)
DROP TABLE IF EXISTS public.raw_event_staging CASCADE;
DROP TABLE IF EXISTS scraper.raw_event_staging CASCADE;
DROP TABLE IF EXISTS public.staged_events CASCADE;
DROP TABLE IF EXISTS public.raw_events CASCADE;
DROP TABLE IF EXISTS public.raw_pages CASCADE;
DROP TABLE IF EXISTS public.pipeline_jobs CASCADE;
DROP TABLE IF EXISTS public.scrape_jobs CASCADE;
DROP TABLE IF EXISTS public.discovery_jobs CASCADE;
DROP TABLE IF EXISTS public.scrape_events CASCADE;
DROP TABLE IF EXISTS public.scrape_state CASCADE;
DROP TABLE IF EXISTS public.scraper_runs CASCADE;
DROP TABLE IF EXISTS public.scraper_failures CASCADE;
DROP TABLE IF EXISTS public.scraper_insights CASCADE;
DROP TABLE IF EXISTS public.error_logs CASCADE;
DROP TABLE IF EXISTS public.dead_letter_queue CASCADE;
DROP TABLE IF EXISTS public.circuit_breaker_state CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.embedding_queue CASCADE;
DROP TABLE IF EXISTS public.scraper_sources_archive CASCADE;
DROP TABLE IF EXISTS public.scraper_sources CASCADE;
DROP TABLE IF EXISTS public.geocode_cache CASCADE;
DROP TABLE IF EXISTS public.cities CASCADE;
DROP TABLE IF EXISTS public.enrichment_logs CASCADE;
DROP TABLE IF EXISTS public.net_http_responses_audit CASCADE;
DROP TABLE IF EXISTS public.app_secrets CASCADE;

-- Phase 4: Drop Types
DROP TYPE IF EXISTS public.fetcher_type_enum CASCADE;
DROP TYPE IF EXISTS public.raw_event_status CASCADE;
DROP TYPE IF EXISTS scraper.event_category_key CASCADE;

-- Phase 5: Drop Schema
DROP SCHEMA IF EXISTS scraper CASCADE;

-- Phase 6: Clean events table
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS source_id CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS scraped_at CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS scraper_source_id CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS raw_event_id CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS extraction_method CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS confidence_score CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS event_fingerprint CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS parsing_method CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS quality_score CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS quality_issues CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS quality_checked_at CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS data_completeness CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS needs_enrichment CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS enrichment_status CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS last_enriched_at CASCADE;

-- Complete!
