-- Migration: Fix update_scraper_source_stats
-- Description: Updates the function to match the actual schema of scraper_sources (removing missing columns successful_scrapes/failed_scrapes).

CREATE OR REPLACE FUNCTION public.update_scraper_source_stats(
  p_source_id UUID,
  p_events_scraped INTEGER,
  p_success BOOLEAN,
  p_last_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE scraper_sources
  SET 
    last_scraped_at = now(),
    total_events_scraped = COALESCE(total_events_scraped, 0) + COALESCE(p_events_scraped, 0),
    last_success = p_success,
    last_error = p_last_error,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE COALESCE(consecutive_failures, 0) + 1 END,
    -- Removed successful_scrapes and failed_scrapes as they do not exist in the table
    updated_at = now()
  WHERE id = p_source_id;
END;
$$;
