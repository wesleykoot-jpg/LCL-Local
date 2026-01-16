-- Create table to archive broken/disabled scraper sources
CREATE TABLE public.scraper_sources_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_source_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  country TEXT,
  language TEXT,
  location_name TEXT,
  default_coordinates JSONB,
  
  -- Archive metadata
  archive_reason TEXT NOT NULL,
  consecutive_failures INTEGER DEFAULT 0,
  last_error TEXT,
  last_scraped_at TIMESTAMPTZ,
  last_success BOOLEAN,
  total_events_scraped INTEGER DEFAULT 0,
  
  -- Timestamps
  original_created_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Optional: for potential restoration
  can_restore BOOLEAN DEFAULT true,
  restore_notes TEXT
);

-- Enable RLS
ALTER TABLE public.scraper_sources_archive ENABLE ROW LEVEL SECURITY;

-- Policies for service role access
CREATE POLICY "Service role can manage archive"
ON public.scraper_sources_archive
FOR ALL
USING (true)
WITH CHECK (true);

-- Authenticated users can view
CREATE POLICY "Authenticated users can view archive"
ON public.scraper_sources_archive
FOR SELECT
USING (true);

-- Add index for lookups
CREATE INDEX idx_scraper_sources_archive_reason ON public.scraper_sources_archive(archive_reason);
CREATE INDEX idx_scraper_sources_archive_url ON public.scraper_sources_archive(url);

-- Add auto_disabled tracking to scraper_sources if not exists (for future auto-healing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scraper_sources' AND column_name = 'disabled_reason') THEN
    ALTER TABLE public.scraper_sources ADD COLUMN disabled_reason TEXT;
  END IF;
END $$;