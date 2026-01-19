-- Migration: Add fetcher_type to scraper_sources
-- Description: Adds the fetcher_type_enum and column required for self-healing logic.

-- Create enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.fetcher_type_enum AS ENUM ('static', 'puppeteer', 'playwright', 'scrapingbee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add column to scraper_sources
ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS fetcher_type public.fetcher_type_enum DEFAULT 'static';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_scraper_sources_fetcher_type ON public.scraper_sources(fetcher_type);

-- Update existing sources to have a default (optional, but good for cleanliness)
UPDATE public.scraper_sources 
SET fetcher_type = 'static' 
WHERE fetcher_type IS NULL;
