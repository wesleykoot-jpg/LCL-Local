-- Add fingerprinting and source linkage on events
ALTER TABLE IF EXISTS public.events
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS event_fingerprint text,
  ADD COLUMN IF NOT EXISTS internal_category text;

-- Ensure fast lookup and deduplication per source
CREATE INDEX IF NOT EXISTS events_source_fingerprint_idx ON public.events (source_id, event_fingerprint);
ALTER TABLE IF EXISTS public.events
  ADD CONSTRAINT events_source_fingerprint_unique UNIQUE (source_id, event_fingerprint);

-- Track scraper reliability and probe telemetry
ALTER TABLE IF EXISTS public.scraper_sources
  ADD COLUMN IF NOT EXISTS reliability_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_probe_urls jsonb;

-- Compute reliability based on attendee engagement vs. total events from the same source
CREATE OR REPLACE FUNCTION public.compute_scraper_reliability(p_source_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_events integer;
  v_engaged integer;
  v_score numeric;
BEGIN
  SELECT COUNT(*) INTO v_total_events FROM public.events e WHERE e.source_id = p_source_id;
  SELECT COUNT(*) INTO v_engaged
  FROM public.event_attendees ea
  JOIN public.events e ON e.id = ea.event_id
  WHERE e.source_id = p_source_id
    AND ea.status = 'going';

  IF COALESCE(v_total_events, 0) = 0 THEN
    v_score := 0;
  ELSE
    v_score := LEAST(1, GREATEST(0, (COALESCE(v_engaged, 0)::numeric / v_total_events::numeric)));
  END IF;

  UPDATE public.scraper_sources
    SET reliability_score = v_score
  WHERE id = p_source_id;

  RETURN v_score;
END;
$$;

-- RPC to update scrape stats after every run
CREATE OR REPLACE FUNCTION public.update_scraper_source_stats(
  p_source_id uuid,
  p_events_scraped integer,
  p_success boolean
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.scraper_sources
    SET last_scraped_at = NOW(),
        last_success_at = CASE WHEN p_success THEN NOW() ELSE last_success_at END,
        consecutive_failures = CASE WHEN p_success THEN 0 ELSE COALESCE(consecutive_failures, 0) + 1 END,
        events_scraped = COALESCE(events_scraped, 0) + COALESCE(p_events_scraped, 0)
  WHERE id = p_source_id;

  PERFORM public.compute_scraper_reliability(p_source_id);
END;
$$;

-- Convenience refresh function
CREATE OR REPLACE FUNCTION public.refresh_all_scraper_reliabilities()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.scraper_sources LOOP
    PERFORM public.compute_scraper_reliability(r.id);
  END LOOP;
END;
$$;
