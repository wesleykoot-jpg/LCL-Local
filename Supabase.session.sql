-- Delta-Detection & Hybrid Parsing Schema Updates (v2)
-- Run this SQL in Supabase SQL Editor

-- 1. Add delta-detection columns to scraper_sources
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='scraper_sources' 
                 AND column_name='last_payload_hash') THEN
    ALTER TABLE public.scraper_sources ADD COLUMN last_payload_hash TEXT;
    RAISE NOTICE 'Added last_payload_hash to scraper_sources';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='scraper_sources' 
                 AND column_name='total_savings_prevented_runs') THEN
    ALTER TABLE public.scraper_sources ADD COLUMN total_savings_prevented_runs INTEGER DEFAULT 0;
    RAISE NOTICE 'Added total_savings_prevented_runs to scraper_sources';
  END IF;
END $$;

-- 2. Add parsing_method to raw_event_staging with CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='raw_event_staging' 
                 AND column_name='parsing_method') THEN
    ALTER TABLE public.raw_event_staging ADD COLUMN parsing_method TEXT;
    ALTER TABLE public.raw_event_staging 
      ADD CONSTRAINT chk_parsing_method 
      CHECK (parsing_method IS NULL OR parsing_method IN ('deterministic', 'ai', 'skipped_no_change'));
    RAISE NOTICE 'Added parsing_method with CHECK constraint to raw_event_staging';
  END IF;
END $$;

-- 3. Add index for parsing_method
CREATE INDEX IF NOT EXISTS idx_staging_parsing_method ON public.raw_event_staging(parsing_method);

-- 4. Create RPC for incrementing savings counter
CREATE OR REPLACE FUNCTION public.increment_savings_counter(p_source_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.scraper_sources 
  SET total_savings_prevented_runs = COALESCE(total_savings_prevented_runs, 0) + 1
  WHERE id = p_source_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify: Show new columns
SELECT 'scraper_sources' AS table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema='public' AND table_name='scraper_sources' 
AND column_name IN ('last_payload_hash', 'total_savings_prevented_runs')
UNION ALL
SELECT 'raw_event_staging' AS table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema='public' AND table_name='raw_event_staging' 
AND column_name = 'parsing_method';
