-- Scraper swarm overhaul: scheduling metadata, job payloads, and RPC helpers

ALTER TABLE public.scrape_jobs
ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS volatility_score numeric DEFAULT 0.5 CHECK (volatility_score >= 0 AND volatility_score <= 1),
ADD COLUMN IF NOT EXISTS next_scrape_at timestamptz,
ADD COLUMN IF NOT EXISTS consecutive_errors integer DEFAULT 0;

COMMENT ON COLUMN public.scraper_sources.consecutive_errors IS
'Scheduler-facing consecutive error counter used for coordinator circuit breaker decisions.';

CREATE INDEX IF NOT EXISTS idx_scraper_sources_next_scrape_at
ON public.scraper_sources (next_scrape_at);

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS idx_events_content_hash
ON public.events (content_hash);

-- Enqueue jobs and update scheduling in a single transaction
CREATE OR REPLACE FUNCTION public.enqueue_scrape_jobs(p_jobs jsonb)
RETURNS TABLE(job_id uuid, source_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_jobs IS NULL OR jsonb_typeof(p_jobs) <> 'array' THEN
    RAISE EXCEPTION 'p_jobs must be a JSON array';
  END IF;

  RETURN QUERY
  WITH job_rows AS (
    SELECT
      (job->>'source_id')::uuid AS source_id,
      COALESCE(job->'payload', '{}'::jsonb) AS payload,
      (job->>'next_scrape_at')::timestamptz AS next_scrape_at
    FROM jsonb_array_elements(p_jobs) job
  ),
  cleaned AS (
    DELETE FROM public.scrape_jobs
    WHERE status = 'pending'
      AND source_id IN (SELECT source_id FROM job_rows)
  ),
  inserted AS (
    INSERT INTO public.scrape_jobs (source_id, status, payload, created_at)
    SELECT source_id, 'pending', payload, NOW()
    FROM job_rows
    RETURNING id, source_id
  ),
  updated AS (
    UPDATE public.scraper_sources s
    SET next_scrape_at = jr.next_scrape_at
    FROM job_rows jr
    WHERE s.id = jr.source_id
      AND jr.next_scrape_at IS NOT NULL
  )
  SELECT id, source_id FROM inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_scrape_jobs(jsonb) TO service_role, authenticated;

-- Claim a batch of pending jobs atomically
CREATE OR REPLACE FUNCTION public.claim_scrape_jobs(p_batch_size integer DEFAULT 5)
RETURNS TABLE(id uuid, source_id uuid, payload jsonb, attempts integer, max_attempts integer)
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

-- Update stats with consecutive error tracking
CREATE OR REPLACE FUNCTION public.update_scraper_source_stats(
  p_source_id UUID,
  p_events_scraped INTEGER,
  p_success BOOLEAN,
  p_last_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.scraper_sources
  SET 
    last_scraped_at = now(),
    total_events_scraped = total_events_scraped + COALESCE(p_events_scraped, 0),
    last_success = p_success,
    last_error = p_last_error,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE COALESCE(consecutive_failures, 0) + 1 END,
    consecutive_errors = CASE WHEN p_success THEN 0 ELSE COALESCE(consecutive_errors, 0) + 1 END,
    successful_scrapes = CASE WHEN p_success THEN successful_scrapes + 1 ELSE successful_scrapes END,
    failed_scrapes = CASE WHEN NOT p_success THEN failed_scrapes + 1 ELSE failed_scrapes END,
    updated_at = now()
  WHERE id = p_source_id;
END;
$$;
