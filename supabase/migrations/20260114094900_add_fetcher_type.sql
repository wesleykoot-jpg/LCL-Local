-- Add fetcher_type field to scraper_sources table
-- This allows per-source configuration of page fetching strategy

-- Create enum type for fetcher types
DO $$ BEGIN
  CREATE TYPE fetcher_type_enum AS ENUM ('static', 'puppeteer', 'playwright', 'scrapingbee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add fetcher_type column with default 'static' to maintain backward compatibility
ALTER TABLE scraper_sources 
ADD COLUMN IF NOT EXISTS fetcher_type fetcher_type_enum DEFAULT 'static';

-- Add index for fetcher type queries
CREATE INDEX IF NOT EXISTS idx_scraper_sources_fetcher_type 
ON scraper_sources (fetcher_type);

-- Add comment for documentation
COMMENT ON COLUMN scraper_sources.fetcher_type IS 'Type of page fetcher to use: static (HTTP), puppeteer, playwright, or scrapingbee';

-- Update existing sources to use 'static' fetcher if requires_render is false (default behavior)
UPDATE scraper_sources 
SET fetcher_type = 'static' 
WHERE fetcher_type IS NULL;
