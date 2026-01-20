-- Migration: Add parsing_method column to raw_event_staging with constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raw_event_staging' AND column_name='parsing_method') THEN
    ALTER TABLE public.raw_event_staging
      ADD COLUMN parsing_method TEXT;
    -- Add CHECK constraint allowing NULL or specific values
    ALTER TABLE public.raw_event_staging
      ADD CONSTRAINT chk_parsing_method CHECK (parsing_method IS NULL OR parsing_method IN ('deterministic', 'ai', 'skipped_no_change'));
    CREATE INDEX IF NOT EXISTS idx_parsing_method ON public.raw_event_staging (parsing_method);
  END IF;
END $$;
