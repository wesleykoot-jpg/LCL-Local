-- =============================================================================
-- SCORCHED EARTH: Complete Scraper Architecture Reset
-- =============================================================================
-- This migration performs a destructive cleanup of ALL scraping, sourcing, 
-- and pipeline-related database objects to prepare for a new architecture.
-- 
-- WARNING: This is IRREVERSIBLE. All scraper data will be permanently deleted.
-- NOTE: This migration does NOT use transactions to allow partial cleanup
-- =============================================================================

-- =============================================================================
-- PHASE 1: Drop Triggers (must come before functions they depend on)
-- =============================================================================

DO $$ 
DECLARE
    trigger_record RECORD;
BEGIN
    -- Dynamically drop scraper-related triggers
    FOR trigger_record IN 
        SELECT DISTINCT trigger_name, event_object_table, event_object_schema
        FROM information_schema.triggers
        WHERE trigger_name ILIKE '%scrap%' 
           OR trigger_name ILIKE '%pipeline%'
           OR trigger_name ILIKE '%embedding%'
           OR trigger_name ILIKE '%processing%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I CASCADE', 
                      trigger_record.trigger_name,
                      trigger_record.event_object_schema,
                      trigger_record.event_object_table);
    END LOOP;
END $$;

-- =============================================================================
-- PHASE 2: Drop Views
-- =============================================================================

DROP VIEW IF EXISTS source_health_status CASCADE;
DROP VIEW IF EXISTS pipeline_dashboard CASCADE;
DROP VIEW IF EXISTS scraper_health_dashboard CASCADE;

-- =============================================================================
-- PHASE 3: Drop Functions (scraper/pipeline related)
-- =============================================================================

-- Scraper source management
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

-- Job queue functions
DROP FUNCTION IF EXISTS public.enqueue_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.claim_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.recover_stuck_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.reset_stuck_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.reset_stuck_discovery_jobs CASCADE;
DROP FUNCTION IF EXISTS public.claim_staging_rows CASCADE;

-- Rate limiting functions
DROP FUNCTION IF EXISTS public.increase_source_rate_limit CASCADE;
DROP FUNCTION IF EXISTS public.reset_expired_rate_limits CASCADE;
DROP FUNCTION IF EXISTS public.get_effective_rate_limit CASCADE;
DROP FUNCTION IF EXISTS public.rate_limit_check CASCADE;
DROP FUNCTION IF EXISTS public.rate_limit_record CASCADE;

-- Circuit breaker functions
DROP FUNCTION IF EXISTS public.cb_record_success CASCADE;
DROP FUNCTION IF EXISTS public.cb_record_failure CASCADE;
DROP FUNCTION IF EXISTS public.cb_check_cooldown CASCADE;

-- Dead letter queue functions
DROP FUNCTION IF EXISTS public.dlq_add CASCADE;
DROP FUNCTION IF EXISTS public.dlq_get_ready_for_retry CASCADE;
DROP FUNCTION IF EXISTS public.dlq_mark_retrying CASCADE;

-- Pipeline functions
DROP FUNCTION IF EXISTS public.cleanup_old_pipeline_data CASCADE;
DROP FUNCTION IF EXISTS public.get_queue_metrics CASCADE;
DROP FUNCTION IF EXISTS public.get_pipeline_health CASCADE;
DROP FUNCTION IF EXISTS public.reset_stale_processing_rows CASCADE;
DROP FUNCTION IF EXISTS public.set_processing_timestamp CASCADE;
DROP FUNCTION IF EXISTS public.update_raw_event_timestamp CASCADE;

-- Self-healing functions
DROP FUNCTION IF EXISTS public.check_and_heal_fetcher CASCADE;
DROP FUNCTION IF EXISTS public.reset_auto_disabled_on_enable CASCADE;
DROP FUNCTION IF EXISTS public.apply_exponential_backoff CASCADE;

-- Embedding queue functions
DROP FUNCTION IF EXISTS public.queue_embedding_generation CASCADE;
DROP FUNCTION IF EXISTS public.get_pending_embedding_jobs CASCADE;
DROP FUNCTION IF EXISTS public.complete_embedding_job CASCADE;
DROP FUNCTION IF EXISTS public.fail_embedding_job CASCADE;

-- Coordinator/automation functions
DROP FUNCTION IF EXISTS public.trigger_scrape_coordinator CASCADE;
DROP FUNCTION IF EXISTS public.invoke_edge_function CASCADE;
DROP FUNCTION IF EXISTS public.poll_net_http_responses_audit CASCADE;

-- Scraper state functions
DROP FUNCTION IF EXISTS public.update_scrape_state_updated_at CASCADE;
DROP FUNCTION IF EXISTS public.get_source_historical_event_count CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_error_logs CASCADE;

-- Geocoding functions
DROP FUNCTION IF EXISTS public.get_events_needing_geocoding CASCADE;

-- =============================================================================
-- PHASE 4: Drop Tables (in dependency order - children first)
-- =============================================================================

-- ELT/Pipeline staging tables
DROP TABLE IF EXISTS public.raw_event_staging CASCADE;
DROP TABLE IF EXISTS scraper.raw_event_staging CASCADE;

-- Pipeline checkpoint tables
DROP TABLE IF EXISTS public.staged_events CASCADE;
DROP TABLE IF EXISTS public.raw_events CASCADE;
DROP TABLE IF EXISTS public.raw_pages CASCADE;
DROP TABLE IF EXISTS public.pipeline_jobs CASCADE;

-- Scraper job tables
DROP TABLE IF EXISTS public.scrape_jobs CASCADE;
DROP TABLE IF EXISTS public.discovery_jobs CASCADE;

-- Scraper observability tables
DROP TABLE IF EXISTS public.scrape_events CASCADE;
DROP TABLE IF EXISTS public.scrape_state CASCADE;
DROP TABLE IF EXISTS public.scraper_runs CASCADE;
DROP TABLE IF EXISTS public.scraper_failures CASCADE;
DROP TABLE IF EXISTS public.scraper_insights CASCADE;
DROP TABLE IF EXISTS public.error_logs CASCADE;

-- Dead letter and circuit breaker
DROP TABLE IF EXISTS public.dead_letter_queue CASCADE;
DROP TABLE IF EXISTS public.circuit_breaker_state CASCADE;

-- Rate limiting
DROP TABLE IF EXISTS public.rate_limits CASCADE;

-- Embedding queue
DROP TABLE IF EXISTS public.embedding_queue CASCADE;

-- Source management
DROP TABLE IF EXISTS public.scraper_sources_archive CASCADE;
DROP TABLE IF EXISTS public.scraper_sources CASCADE;

-- Geocoding cache
DROP TABLE IF EXISTS public.geocode_cache CASCADE;

-- Cities (discovery-related)
DROP TABLE IF EXISTS public.cities CASCADE;

-- Enrichment and insights
DROP TABLE IF EXISTS public.enrichment_logs CASCADE;

-- Network audit
DROP TABLE IF EXISTS public.net_http_responses_audit CASCADE;

-- App secrets (if scraper-related)
DROP TABLE IF EXISTS public.app_secrets CASCADE;

-- =============================================================================
-- PHASE 5: Drop Custom Types
-- =============================================================================

DROP TYPE IF EXISTS public.fetcher_type_enum CASCADE;
DROP TYPE IF EXISTS public.raw_event_status CASCADE;
DROP TYPE IF EXISTS scraper.event_category_key CASCADE;

-- =============================================================================
-- PHASE 6: Drop Schemas
-- =============================================================================

DROP SCHEMA IF EXISTS scraper CASCADE;

-- =============================================================================
-- PHASE 7: Clean up cron jobs (if pg_cron is installed)
-- =============================================================================

-- Attempt to unschedule any scraper-related cron jobs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove all scraper/pipeline related cron jobs
    DELETE FROM cron.job WHERE jobname LIKE '%scrape%';
    DELETE FROM cron.job WHERE jobname LIKE '%pipeline%';
    DELETE FROM cron.job WHERE jobname LIKE '%discovery%';
    DELETE FROM cron.job WHERE jobname LIKE '%coordinator%';
    DELETE FROM cron.job WHERE jobname LIKE '%worker%';
    DELETE FROM cron.job WHERE jobname LIKE '%reset_stuck%';
    DELETE FROM cron.job WHERE jobname LIKE '%cleanup%';
    DELETE FROM cron.job WHERE jobname LIKE '%process-worker%';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- pg_cron not installed, skip
END;
$$;

-- =============================================================================
-- PHASE 8: Remove scraper-related columns from events table (if any)
-- =============================================================================

-- Remove scraper-specific columns from events table but KEEP the events table itself
DO $$
BEGIN
  -- Drop source_id foreign key if it exists
  ALTER TABLE events DROP COLUMN IF EXISTS source_id;
  ALTER TABLE events DROP COLUMN IF EXISTS scraped_at;
  ALTER TABLE events DROP COLUMN IF EXISTS scraper_source_id;
  ALTER TABLE events DROP COLUMN IF EXISTS raw_event_id;
  ALTER TABLE events DROP COLUMN IF EXISTS extraction_method;
  ALTER TABLE events DROP COLUMN IF EXISTS confidence_score;
  ALTER TABLE events DROP COLUMN IF EXISTS event_fingerprint;
  ALTER TABLE events DROP COLUMN IF EXISTS parsing_method;
  ALTER TABLE events DROP COLUMN IF EXISTS quality_score;
  ALTER TABLE events DROP COLUMN IF EXISTS quality_issues;
  ALTER TABLE events DROP COLUMN IF EXISTS quality_checked_at;
  ALTER TABLE events DROP COLUMN IF EXISTS data_completeness;
  ALTER TABLE events DROP COLUMN IF EXISTS needs_enrichment;
  ALTER TABLE events DROP COLUMN IF EXISTS enrichment_status;
  ALTER TABLE events DROP COLUMN IF EXISTS last_enriched_at;
EXCEPTION
  WHEN undefined_column THEN
    NULL; -- Column doesn't exist, skip
END;
$$;

COMMIT;

-- =============================================================================
-- VERIFICATION: List remaining scraper artifacts (should be empty)
-- =============================================================================

-- Run this after migration to verify cleanup:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name LIKE '%scrap%' OR table_name LIKE '%pipeline%';
--
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND (routine_name LIKE '%scrap%' OR routine_name LIKE '%pipeline%');
