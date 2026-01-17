-- Migration: Add rate-limit state columns to scraper_sources
-- Purpose: Surface per-source API rate-limit state in Scraper Admin UI
-- Part of: Issue #surface-api-rate-limit-state

-- Add nullable columns to store the last observed rate-limit state from API responses
ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS last_rate_limit_remaining integer NULL,
ADD COLUMN IF NOT EXISTS last_rate_limit_reset_ts timestamptz NULL,
ADD COLUMN IF NOT EXISTS last_rate_limit_retry_after_seconds integer NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.scraper_sources.last_rate_limit_remaining IS 
  'Last observed X-RateLimit-Remaining or similar header value from API response';

COMMENT ON COLUMN public.scraper_sources.last_rate_limit_reset_ts IS 
  'Timestamp when the rate limit will reset, parsed from X-RateLimit-Reset or similar header';

COMMENT ON COLUMN public.scraper_sources.last_rate_limit_retry_after_seconds IS 
  'Retry-After header value in seconds from 429/403 responses';
