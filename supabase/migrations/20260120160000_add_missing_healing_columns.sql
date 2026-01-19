-- Migration: Add missing columns for self-healing
-- Description: Adds consecutive_zero_events and last_non_zero_scrape which are required by check_and_heal_fetcher.

ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS consecutive_zero_events integer DEFAULT 0;

ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS last_non_zero_scrape timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.scraper_sources.consecutive_zero_events IS 'Number of consecutive scrapes returning 0 events with HTTP 200 status';
COMMENT ON COLUMN public.scraper_sources.last_non_zero_scrape IS 'Timestamp of last successful scrape that returned >0 events';
