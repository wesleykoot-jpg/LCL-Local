-- Track scraper failures with error messages and link events to sources

-- Add source tracking to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.scraper_sources(id);

CREATE INDEX IF NOT EXISTS idx_events_source_date ON public.events (source_id, event_date);

-- Update scraper stats function to record failures and errors
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
    total_events_scraped = total_events_scraped + COALESCE(p_events_scraped, 0),
    last_success = p_success,
    last_error = p_last_error,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
    successful_scrapes = CASE WHEN p_success THEN successful_scrapes + 1 ELSE successful_scrapes END,
    failed_scrapes = CASE WHEN NOT p_success THEN failed_scrapes + 1 ELSE failed_scrapes END,
    updated_at = now()
  WHERE id = p_source_id;
END;
$$;
