-- Create scraper_sources table for configurable scraping
CREATE TABLE IF NOT EXISTS public.scraper_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_scraped_at TIMESTAMPTZ,
  total_events_scraped INTEGER DEFAULT 0,
  last_success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scraper_sources ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view sources (internal tool)
CREATE POLICY "Allow authenticated to view scraper sources"
  ON public.scraper_sources
  FOR SELECT
  TO authenticated
  USING (true);

-- Create function to update scraper source stats
CREATE OR REPLACE FUNCTION public.update_scraper_source_stats(
  p_source_id UUID,
  p_events_scraped INTEGER,
  p_success BOOLEAN
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
    total_events_scraped = total_events_scraped + p_events_scraped,
    last_success = p_success,
    updated_at = now()
  WHERE id = p_source_id;
END;
$$;

-- Insert the Meppel events source
INSERT INTO public.scraper_sources (name, url, enabled, config)
VALUES (
  'Ontdek Meppel Agenda',
  'https://www.ontdekmeppel.nl/agenda',
  true,
  '{"selectors": ["article.agenda-item", "article.event-card", ".event-item"], "rate_limit_ms": 300}'::jsonb
);