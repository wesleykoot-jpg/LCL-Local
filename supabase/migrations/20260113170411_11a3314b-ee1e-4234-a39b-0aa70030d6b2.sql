-- Add source_id and event_fingerprint columns to events table for scraper deduplication
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.scraper_sources(id),
ADD COLUMN IF NOT EXISTS event_fingerprint TEXT;

-- Create index on fingerprint for fast duplicate lookups
CREATE INDEX IF NOT EXISTS idx_events_fingerprint ON public.events(event_fingerprint);

-- Create index on source_id for source-based queries
CREATE INDEX IF NOT EXISTS idx_events_source_id ON public.events(source_id);

-- Update RLS policy to allow service role to insert scraped events
CREATE POLICY "Service role can insert scraped events" 
ON public.events 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can update scraped events" 
ON public.events 
FOR UPDATE 
USING (true)
WITH CHECK (true);