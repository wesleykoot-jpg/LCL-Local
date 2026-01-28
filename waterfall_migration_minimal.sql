
-- WATERFALL PIPELINE MIGRATION (Minimal)
-- Run this in Supabase SQL Editor

-- 1. Create the pipeline status enum
DO $$ BEGIN
  CREATE TYPE public.pipeline_status AS ENUM (
    'discovered', 'awaiting_enrichment', 'enriching', 'enriched',
    'ready_to_index', 'indexing', 'processed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add columns to raw_event_staging
ALTER TABLE public.raw_event_staging
ADD COLUMN IF NOT EXISTS pipeline_status public.pipeline_status DEFAULT 'discovered',
ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS indexing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS worker_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT NULL;

-- 3. Create index
CREATE INDEX IF NOT EXISTS idx_staging_pipeline_status 
ON public.raw_event_staging (pipeline_status);

-- 4. Set existing rows to awaiting_enrichment
UPDATE public.raw_event_staging
SET pipeline_status = 'awaiting_enrichment'
WHERE pipeline_status IS NULL;

-- Done! Run the following to verify:
-- SELECT pipeline_status, COUNT(*) FROM raw_event_staging GROUP BY pipeline_status;
