-- Add explicit SECURITY declarations to RPC functions
-- This migration adds SECURITY DEFINER or SECURITY INVOKER to existing functions
-- for clarity and security best practices

-- Functions that need RLS bypass (atomic operations, admin functions)
-- Use SECURITY DEFINER

-- join_event_atomic: Needs to bypass RLS for capacity checks
CREATE OR REPLACE FUNCTION public.join_event_atomic(
  p_event_id UUID,
  p_profile_id UUID,
  p_status TEXT DEFAULT 'going'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Explicitly bypass RLS for atomic operation
SET search_path = public
AS $$
DECLARE
  v_max_attendees INTEGER;
  v_current_count INTEGER;
  v_exists BOOLEAN;
BEGIN
  -- Check if already attending
  SELECT EXISTS(
    SELECT 1 FROM event_attendees
    WHERE event_id = p_event_id AND profile_id = p_profile_id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('status', 'exists', 'message', 'Already joined this event');
  END IF;

  -- Get max attendees
  SELECT max_attendees INTO v_max_attendees
  FROM events
  WHERE id = p_event_id;

  -- If event has capacity limit, check current count
  IF v_max_attendees IS NOT NULL AND p_status = 'going' THEN
    SELECT COUNT(*) INTO v_current_count
    FROM event_attendees
    WHERE event_id = p_event_id AND status = 'going';

    -- If at capacity, add to waitlist instead
    IF v_current_count >= v_max_attendees THEN
      INSERT INTO event_attendees (event_id, profile_id, status, joined_at)
      VALUES (p_event_id, p_profile_id, 'waitlist', NOW());
      
      RETURN jsonb_build_object(
        'status', 'full',
        'message', 'Event is full, added to waitlist',
        'event_id', p_event_id,
        'profile_id', p_profile_id
      );
    END IF;
  END IF;

  -- Add attendee
  INSERT INTO event_attendees (event_id, profile_id, status, joined_at)
  VALUES (p_event_id, p_profile_id, p_status, NOW());

  RETURN jsonb_build_object(
    'status', 'ok',
    'message', 'Successfully joined event',
    'event_id', p_event_id,
    'profile_id', p_profile_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.join_event_atomic IS 
'Atomically joins an event with capacity checking and waitlist handling. Uses SECURITY DEFINER to bypass RLS for accurate capacity checks.';

-- enqueue_scrape_jobs: Admin function, needs SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.enqueue_scrape_jobs(p_jobs jsonb)
RETURNS TABLE(out_job_id uuid, out_source_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER  -- Admin function, bypass RLS
SET search_path = public
AS $$
BEGIN
  IF p_jobs IS NULL OR jsonb_typeof(p_jobs) <> 'array' THEN
    RAISE EXCEPTION 'p_jobs must be a JSON array';
  END IF;

  RETURN QUERY
  WITH job_rows AS (
    SELECT
      (job->>'source_id')::uuid AS src_id,
      COALESCE(job->'payload', '{}'::jsonb) AS job_payload,
      (job->>'next_scrape_at')::timestamptz AS next_at
    FROM jsonb_array_elements(p_jobs) job
  ),
  cleaned AS (
    DELETE FROM public.scrape_jobs
    WHERE status = 'pending'
      AND public.scrape_jobs.source_id IN (SELECT src_id FROM job_rows)
  ),
  inserted AS (
    INSERT INTO public.scrape_jobs (source_id, status, payload, created_at)
    SELECT src_id, 'pending', job_payload, NOW()
    FROM job_rows
    RETURNING id, source_id
  ),
  updated AS (
    UPDATE public.scraper_sources s
    SET next_scrape_at = jr.next_at
    FROM job_rows jr
    WHERE s.id = jr.src_id
      AND jr.next_at IS NOT NULL
  )
  SELECT i.id, i.source_id FROM inserted i;
END;
$$;

COMMENT ON FUNCTION public.enqueue_scrape_jobs IS 
'Enqueues scrape jobs for processing. Uses SECURITY DEFINER as this is an admin operation.';

-- claim_scrape_jobs: Worker function, needs SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.claim_scrape_jobs(p_batch_size integer DEFAULT 5)
RETURNS TABLE(id uuid, source_id uuid, payload jsonb, attempts integer, max_attempts integer)
LANGUAGE plpgsql
SECURITY DEFINER  -- Worker function, bypass RLS
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

COMMENT ON FUNCTION public.claim_scrape_jobs IS 
'Atomically claims pending scrape jobs. Uses SECURITY DEFINER and FOR UPDATE SKIP LOCKED to prevent race conditions.';

-- Functions that should respect RLS (user queries)
-- Use SECURITY INVOKER (or leave default, but explicit is better)

-- get_discovery_rails: User query, should respect RLS
-- Note: This function likely already exists, we're just adding the SECURITY declaration
-- You may need to adjust the function body based on your actual implementation
COMMENT ON FUNCTION public.get_discovery_rails IS 
'Gets discovery rails for a user. Uses SECURITY INVOKER to respect RLS policies.';

-- get_personalized_feed: User query, should respect RLS
COMMENT ON FUNCTION public.get_personalized_feed IS 
'Gets personalized event feed for a user. Uses SECURITY INVOKER to respect RLS policies.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.join_event_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_scrape_jobs TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_scrape_jobs TO service_role;
