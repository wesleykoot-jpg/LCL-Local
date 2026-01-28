-- Add UNIQUE constraint to source_url for upsert operations
-- This enables ON CONFLICT (source_url) DO UPDATE in the scraper

-- First, remove any duplicate source_urls if they exist
-- Keep the oldest row for each source_url
DELETE FROM public.raw_event_staging a
USING public.raw_event_staging b
WHERE a.id > b.id 
  AND a.source_url = b.source_url;

-- Now add the UNIQUE constraint
ALTER TABLE public.raw_event_staging
ADD CONSTRAINT raw_event_staging_source_url_unique 
UNIQUE (source_url);

-- Add index for performance (if not already covered by unique constraint)
CREATE INDEX IF NOT EXISTS idx_raw_event_staging_source_url 
ON public.raw_event_staging (source_url);

COMMENT ON CONSTRAINT raw_event_staging_source_url_unique ON public.raw_event_staging 
IS 'Ensures each event URL is only staged once, enables upsert operations';
