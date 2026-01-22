-- Atomic Row Claiming for Process Worker
-- Prevents race conditions when multiple workers try to claim the same rows

CREATE OR REPLACE FUNCTION public.claim_staging_rows(p_batch_size INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  source_id UUID,
  url TEXT,
  raw_payload JSONB,
  raw_html TEXT,
  detail_html TEXT,
  status TEXT,
  parsing_method TEXT
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
    WHERE status = 'pending'
      AND (retry_count IS NULL OR retry_count < 3)
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED  -- Atomic lock prevents race conditions
  )
  UPDATE raw_event_staging
  SET 
    status = 'processing',
    processing_started_at = NOW(),
    updated_at = NOW()
  WHERE raw_event_staging.id IN (SELECT id FROM candidates)
  RETURNING 
    raw_event_staging.id,
    raw_event_staging.source_id,
    raw_event_staging.url,
    raw_event_staging.raw_payload,
    raw_event_staging.raw_html,
    raw_event_staging.detail_html,
    raw_event_staging.status,
    raw_event_staging.parsing_method;
END;
$$;

COMMENT ON FUNCTION public.claim_staging_rows(INTEGER) IS 
'Atomically claims pending rows from raw_event_staging for processing. Uses FOR UPDATE SKIP LOCKED to prevent race conditions between multiple workers.';

GRANT EXECUTE ON FUNCTION public.claim_staging_rows(INTEGER) TO service_role;
