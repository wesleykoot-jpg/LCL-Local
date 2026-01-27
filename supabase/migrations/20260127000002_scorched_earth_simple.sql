-- SCORCHED EARTH: Complete Scraper Architecture Reset

DROP VIEW IF EXISTS source_health_status CASCADE;
DROP VIEW IF EXISTS pipeline_dashboard CASCADE;
DROP VIEW IF EXISTS scraper_health_dashboard CASCADE;

DROP FUNCTION IF EXISTS public.add_scraper_source CASCADE;
DROP FUNCTION IF EXISTS public.toggle_scraper_source CASCADE;
DROP FUNCTION IF EXISTS public.update_scraper_source_stats CASCADE;
DROP FUNCTION IF EXISTS public.compute_scraper_reliability CASCADE;
DROP FUNCTION IF EXISTS public.log_scraper_insight CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.claim_scrape_jobs CASCADE;
DROP FUNCTION IF EXISTS public.claim_staging_rows CASCADE;
DROP FUNCTION IF EXISTS public.cb_record_success CASCADE;
DROP FUNCTION IF EXISTS public.cb_record_failure CASCADE;
DROP FUNCTION IF EXISTS public.dlq_add CASCADE;
DROP FUNCTION IF EXISTS public.get_pipeline_health CASCADE;
DROP FUNCTION IF EXISTS public.check_and_heal_fetcher CASCADE;

DROP TABLE IF EXISTS public.raw_event_staging CASCADE;
DROP TABLE IF EXISTS public.staged_events CASCADE;
DROP TABLE IF EXISTS public.raw_events CASCADE;
DROP TABLE IF EXISTS public.raw_pages CASCADE;
DROP TABLE IF EXISTS public.pipeline_jobs CASCADE;
DROP TABLE IF EXISTS public.scrape_jobs CASCADE;
DROP TABLE IF EXISTS public.discovery_jobs CASCADE;
DROP TABLE IF EXISTS public.scrape_events CASCADE;
DROP TABLE IF EXISTS public.scraper_runs CASCADE;
DROP TABLE IF EXISTS public.scraper_insights CASCADE;
DROP TABLE IF EXISTS public.dead_letter_queue CASCADE;
DROP TABLE IF EXISTS public.circuit_breaker_state CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.scraper_sources CASCADE;
DROP TABLE IF EXISTS public.geocode_cache CASCADE;

DROP TYPE IF EXISTS public.fetcher_type_enum CASCADE;
DROP TYPE IF EXISTS public.raw_event_status CASCADE;

DROP SCHEMA IF EXISTS scraper CASCADE;

ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS source_id CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS scraped_at CASCADE;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS scraper_source_id CASCADE;
