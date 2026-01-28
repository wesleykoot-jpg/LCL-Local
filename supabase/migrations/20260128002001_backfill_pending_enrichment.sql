-- Backfill Script: Trigger Enrichment for Pending Rows
-- 
-- Run this ONCE after applying the push-based trigger migration.
-- This processes any rows that were in awaiting_enrichment status
-- before the trigger was installed.
--
-- Usage: Run via Supabase SQL Editor or psql

DO $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_pending_count INTEGER;
  v_request_id BIGINT;
  v_row RECORD;
  v_processed INTEGER := 0;
BEGIN
  -- Get configuration
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
  -- Fallback to env vars
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := current_setting('supabase.url', true);
  END IF;
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    v_service_role_key := current_setting('supabase.service_role_key', true);
  END IF;
  
  -- Check if we have valid configuration
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE EXCEPTION 'Missing Supabase configuration. Set app.supabase_url and app.supabase_service_role_key';
  END IF;
  
  -- Count pending rows
  SELECT COUNT(*) INTO v_pending_count
  FROM public.raw_event_staging
  WHERE pipeline_status = 'awaiting_enrichment';
  
  IF v_pending_count = 0 THEN
    RAISE NOTICE 'No pending enrichment rows to backfill. All caught up!';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found % rows in awaiting_enrichment status. Starting backfill...', v_pending_count;
  
  -- Process each pending row
  FOR v_row IN (
    SELECT id, source_id, source_url, detail_url, title, raw_html, created_at
    FROM public.raw_event_staging
    WHERE pipeline_status = 'awaiting_enrichment'
    ORDER BY created_at ASC
    LIMIT 100  -- Process in batches of 100 to avoid overwhelming the worker
  )
  LOOP
    -- Send HTTP POST to enrichment-worker
    SELECT extensions.http_post(
      url := v_supabase_url || '/functions/v1/enrichment-worker',
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'raw_event_staging',
        'schema', 'public',
        'record', jsonb_build_object(
          'id', v_row.id,
          'source_id', v_row.source_id,
          'source_url', v_row.source_url,
          'detail_url', v_row.detail_url,
          'title', v_row.title,
          'raw_html', v_row.raw_html,
          'pipeline_status', 'awaiting_enrichment',
          'created_at', v_row.created_at
        ),
        'old_record', NULL
      ),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_role_key,
        'Content-Type', 'application/json'
      ),
      timeout_milliseconds := 5000
    ) INTO v_request_id;
    
    v_processed := v_processed + 1;
    
    -- Log progress every 10 rows
    IF v_processed % 10 = 0 THEN
      RAISE NOTICE 'Backfill progress: %/% rows queued', v_processed, v_pending_count;
    END IF;
    
    -- Small delay to avoid overwhelming the worker (100ms between requests)
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RAISE NOTICE '✓ Backfill complete: % enrichment requests queued', v_processed;
  
  -- Report remaining if we hit the batch limit
  IF v_pending_count > 100 THEN
    RAISE NOTICE '⚠ Note: Only processed first 100 rows. Re-run this script to process remaining % rows.', v_pending_count - 100;
  END IF;
END;
$$;

-- Verify the HTTP request queue
SELECT 
  'Queued requests' as metric,
  COUNT(*) as value
FROM extensions.http_request_queue 
WHERE url LIKE '%enrichment-worker%'
  AND created_at > NOW() - INTERVAL '10 minutes';
