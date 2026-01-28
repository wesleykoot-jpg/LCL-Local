-- Fix claim_staging_rows returning columns to match current raw_event_staging schema
BEGIN;

CREATE OR REPLACE FUNCTION public.claim_staging_rows(p_batch_size INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  source_id UUID,
  source_url TEXT,
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
    WHERE raw_event_staging.status = 'awaiting_enrichment'
      AND (raw_event_staging.retry_count IS NULL OR raw_event_staging.retry_count < 3)
    ORDER BY raw_event_staging.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE raw_event_staging
  SET
    status = 'processing',
    processing_started_at = NOW(),
    updated_at = NOW()
  WHERE raw_event_staging.id IN (SELECT candidates.id FROM candidates)
  RETURNING
    raw_event_staging.id,
    raw_event_staging.source_id,
    raw_event_staging.source_url,
    NULL::jsonb AS raw_payload,
    raw_event_staging.raw_html,
    raw_event_staging.detail_html,
    raw_event_staging.status::TEXT,
    raw_event_staging.parsing_method::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_staging_rows(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_staging_rows(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_staging_rows(INTEGER) TO anon;

COMMIT;
