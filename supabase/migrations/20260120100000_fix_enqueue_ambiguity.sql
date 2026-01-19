-- Migration: Fix ambiguous column in enqueue_scrape_jobs
-- Description: Replaces the enqueue_scrape_jobs function with unambiguous column references and aliases.

CREATE OR REPLACE FUNCTION public.enqueue_scrape_jobs(p_jobs jsonb)
RETURNS TABLE(out_job_id uuid, out_source_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_jobs IS NULL OR jsonb_typeof(p_jobs) <> 'array' THEN
    RAISE EXCEPTION 'p_jobs must be a JSON array';
  END IF;

  RETURN QUERY
  WITH job_data AS (
    SELECT
      (job->>'source_id')::uuid AS _src_id,
      COALESCE(job->'payload', '{}'::jsonb) AS _payload,
      (job->>'next_scrape_at')::timestamptz AS _next_at
    FROM jsonb_array_elements(p_jobs) job
  ),
  deleted_jobs AS (
    DELETE FROM public.scrape_jobs
    WHERE status = 'pending'
      AND source_id IN (SELECT _src_id FROM job_data)
  ),
  new_jobs AS (
    INSERT INTO public.scrape_jobs (source_id, status, payload, created_at)
    SELECT _src_id, 'pending', _payload, NOW()
    FROM job_data
    RETURNING id, source_id
  ),
  updated_sources AS (
    UPDATE public.scraper_sources
    SET next_scrape_at = jd._next_at
    FROM job_data jd
    WHERE public.scraper_sources.id = jd._src_id
      AND jd._next_at IS NOT NULL
  )
  SELECT new_jobs.id, new_jobs.source_id FROM new_jobs;
END;
$$;
