-- Delta-Detection & Hybrid Parsing Schema Updates
-- Run this SQL in Supabase SQL Editor

-- 1. Add delta-detection columns to scraper_sources
ALTER TABLE public.scraper_sources 
  ADD COLUMN IF NOT EXISTS last_payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS total_savings_prevented_runs INTEGER DEFAULT 0;

-- 2. Add parsing_method to raw_event_staging
ALTER TABLE public.raw_event_staging 
  ADD COLUMN IF NOT EXISTS parsing_method TEXT; -- 'deterministic' | 'ai' | 'skipped_no_change'

-- 3. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staging_parsing_method ON public.raw_event_staging(parsing_method);

-- Verify changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'scraper_sources' AND column_name IN ('last_payload_hash', 'total_savings_prevented_runs');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'raw_event_staging' AND column_name = 'parsing_method';
