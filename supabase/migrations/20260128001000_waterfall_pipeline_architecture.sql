-- Migration: Implement Decoupled Waterfall Pipeline Architecture
-- This converts the monolithic process-worker into a 3-stage state machine:
-- 1. DISCOVERED: Scraper found URL, minimal data
-- 2. AWAITING_ENRICHMENT: Ready for deep dive (detail fetch + AI parsing)
-- 3. ENRICHED: Social Five extracted, ready for indexing
-- 4. READY_TO_INDEX: Final validation passed
-- 5. PROCESSED: Moved to production events table
-- 6. FAILED: Permanent failure after max retries

-- =============================================================================
-- 1. Create New Status Enum
-- =============================================================================

-- Create new enum type for pipeline states
DO $$ BEGIN
  CREATE TYPE public.pipeline_status AS ENUM (
    'discovered',
    'awaiting_enrichment', 
    'enriching',
    'enriched',
    'ready_to_index',
    'indexing',
    'processed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. Add New Columns for Waterfall Pipeline
-- =============================================================================

-- Add pipeline-specific columns to raw_event_staging
ALTER TABLE public.raw_event_staging
ADD COLUMN IF NOT EXISTS pipeline_status pipeline_status DEFAULT 'discovered',
ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS indexing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS worker_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT NULL;

-- Add index for efficient status-based queries
CREATE INDEX IF NOT EXISTS idx_staging_pipeline_status 
ON public.raw_event_staging (pipeline_status);

CREATE INDEX IF NOT EXISTS idx_staging_discovered
ON public.raw_event_staging (created_at ASC)
WHERE pipeline_status = 'discovered';

CREATE INDEX IF NOT EXISTS idx_staging_ready_to_index
ON public.raw_event_staging (enriched_at ASC)
WHERE pipeline_status = 'ready_to_index';

-- =============================================================================
-- 3. Migration: Convert Existing Status Values
-- =============================================================================

-- Map existing status values to new pipeline_status
UPDATE public.raw_event_staging
SET pipeline_status = CASE 
  WHEN status::TEXT = 'awaiting_fetch' THEN 'discovered'::pipeline_status
  WHEN status::TEXT = 'awaiting_enrichment' THEN 'awaiting_enrichment'::pipeline_status
  WHEN status::TEXT = 'processing' THEN 'enriching'::pipeline_status
  WHEN status::TEXT = 'completed' THEN 'processed'::pipeline_status
  WHEN status::TEXT = 'failed' THEN 'failed'::pipeline_status
  ELSE 'discovered'::pipeline_status
END
WHERE pipeline_status IS NULL OR pipeline_status = 'discovered';

-- =============================================================================
-- 4. Claim Functions for Each Stage
-- =============================================================================

-- Function to claim events for enrichment (1 at a time for webhook trigger)
CREATE OR REPLACE FUNCTION public.claim_for_enrichment(p_worker_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  source_id UUID,
  source_url TEXT,
  detail_url TEXT,
  raw_html TEXT,
  title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT raw_event_staging.id
    FROM raw_event_staging
    WHERE raw_event_staging.pipeline_status = 'awaiting_enrichment'
      AND (raw_event_staging.enrichment_attempts < 3)
    ORDER BY raw_event_staging.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE raw_event_staging
  SET
    pipeline_status = 'enriching',
    enrichment_attempts = enrichment_attempts + 1,
    worker_id = COALESCE(p_worker_id, gen_random_uuid()),
    updated_at = NOW()
  WHERE raw_event_staging.id = (SELECT candidate.id FROM candidate)
  RETURNING
    raw_event_staging.id,
    raw_event_staging.source_id,
    raw_event_staging.source_url,
    raw_event_staging.detail_url,
    raw_event_staging.raw_html,
    raw_event_staging.title;
END;
$$;

-- Function to claim batch for indexing
CREATE OR REPLACE FUNCTION public.claim_for_indexing(p_batch_size INTEGER DEFAULT 20)
RETURNS TABLE(
  id UUID,
  source_id UUID,
  source_url TEXT,
  structured_data JSONB,
  title TEXT,
  description TEXT,
  event_date DATE,
  event_time TIME,
  venue_name TEXT,
  venue_address TEXT,
  coordinates GEOGRAPHY,
  category TEXT,
  image_url TEXT,
  price TEXT,
  tickets_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT raw_event_staging.id
    FROM raw_event_staging
    WHERE raw_event_staging.pipeline_status = 'ready_to_index'
      AND (raw_event_staging.indexing_attempts < 3)
    ORDER BY raw_event_staging.enriched_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE raw_event_staging
  SET
    pipeline_status = 'indexing',
    indexing_attempts = indexing_attempts + 1,
    updated_at = NOW()
  WHERE raw_event_staging.id IN (SELECT candidates.id FROM candidates)
  RETURNING
    raw_event_staging.id,
    raw_event_staging.source_id,
    raw_event_staging.source_url,
    raw_event_staging.structured_data,
    raw_event_staging.title,
    raw_event_staging.description,
    raw_event_staging.event_date,
    raw_event_staging.event_time,
    raw_event_staging.venue_name,
    raw_event_staging.venue_address,
    raw_event_staging.coordinates,
    raw_event_staging.category,
    raw_event_staging.image_url,
    raw_event_staging.price,
    raw_event_staging.tickets_url;
END;
$$;

-- Function to mark enrichment complete
CREATE OR REPLACE FUNCTION public.complete_enrichment(
  p_id UUID,
  p_structured_data JSONB,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_event_date DATE DEFAULT NULL,
  p_event_time TIME DEFAULT NULL,
  p_venue_name TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE raw_event_staging
  SET
    pipeline_status = 'ready_to_index',
    structured_data = p_structured_data,
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    event_date = COALESCE(p_event_date, event_date),
    event_time = COALESCE(p_event_time, event_time),
    venue_name = COALESCE(p_venue_name, venue_name),
    category = COALESCE(p_category, category),
    image_url = COALESCE(p_image_url, image_url),
    enriched_at = NOW(),
    updated_at = NOW(),
    worker_id = NULL
  WHERE id = p_id;
END;
$$;

-- Function to mark indexing complete
CREATE OR REPLACE FUNCTION public.complete_indexing(p_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE raw_event_staging
  SET
    pipeline_status = 'processed',
    indexed_at = NOW(),
    updated_at = NOW()
  WHERE id = ANY(p_ids);
END;
$$;

-- Function to fail an enrichment (with retry logic)
CREATE OR REPLACE FUNCTION public.fail_enrichment(
  p_id UUID,
  p_error TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
BEGIN
  SELECT enrichment_attempts INTO v_attempts
  FROM raw_event_staging WHERE id = p_id;
  
  IF v_attempts >= 3 THEN
    -- Max retries reached, mark as failed
    UPDATE raw_event_staging
    SET
      pipeline_status = 'failed',
      last_error = p_error,
      updated_at = NOW(),
      worker_id = NULL
    WHERE id = p_id;
  ELSE
    -- Put back in queue for retry
    UPDATE raw_event_staging
    SET
      pipeline_status = 'awaiting_enrichment',
      last_error = p_error,
      updated_at = NOW(),
      worker_id = NULL
    WHERE id = p_id;
  END IF;
END;
$$;

-- =============================================================================
-- 5. Grant Permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.claim_for_enrichment(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_for_indexing(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_enrichment(UUID, JSONB, TEXT, TEXT, DATE, TIME, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_indexing(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_enrichment(UUID, TEXT) TO service_role;

-- =============================================================================
-- 6. Pipeline Status View for Monitoring
-- =============================================================================

CREATE OR REPLACE VIEW public.pipeline_status_summary AS
SELECT 
  pipeline_status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(updated_at) as last_updated,
  AVG(enrichment_attempts)::NUMERIC(3,1) as avg_enrichment_attempts
FROM public.raw_event_staging
GROUP BY pipeline_status
ORDER BY 
  CASE pipeline_status
    WHEN 'discovered' THEN 1
    WHEN 'awaiting_enrichment' THEN 2
    WHEN 'enriching' THEN 3
    WHEN 'enriched' THEN 4
    WHEN 'ready_to_index' THEN 5
    WHEN 'indexing' THEN 6
    WHEN 'processed' THEN 7
    WHEN 'failed' THEN 8
  END;

COMMENT ON VIEW public.pipeline_status_summary IS 
  'Real-time overview of the waterfall pipeline - shows count per stage';
