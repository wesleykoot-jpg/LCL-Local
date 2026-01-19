-- Migration: Fix ambiguous column in claim_scrape_jobs
-- Description: Renames output parameters to avoid conflict with table columns.

DROP FUNCTION IF EXISTS public.claim_scrape_jobs(integer);

CREATE OR REPLACE FUNCTION public.claim_scrape_jobs(p_batch_size integer DEFAULT 5)
RETURNS TABLE(out_id uuid, out_source_id uuid, out_payload jsonb, out_attempts integer, out_max_attempts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.scrape_jobs
    WHERE status = 'pending'
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scrape_jobs
  SET status = 'processing',
      started_at = NOW(),
      attempts = attempts + 1
  WHERE id IN (SELECT id FROM candidates)
  RETURNING id, source_id, payload, attempts, max_attempts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_scrape_jobs(integer) TO service_role, authenticated;
