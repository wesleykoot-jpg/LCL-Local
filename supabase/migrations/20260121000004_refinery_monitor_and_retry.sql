-- Migration: Refinery Monitoring and Retry Logic
-- Description: Adds retry_count to raw_event_staging and creates get_queue_metrics RPC

-- 1. Add retry_count column
ALTER TABLE public.raw_event_staging
ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

-- 2. Create Queue Monitor Function
CREATE OR REPLACE FUNCTION public.get_queue_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pending INT;
    v_processing INT;
    v_completed INT;
    v_failed INT;
    v_avg_processing_time NUMERIC;
BEGIN
    -- Get counts
    SELECT COUNT(*) INTO v_pending FROM public.raw_event_staging WHERE status = 'pending';
    SELECT COUNT(*) INTO v_processing FROM public.raw_event_staging WHERE status = 'processing';
    SELECT COUNT(*) INTO v_completed FROM public.raw_event_staging WHERE status = 'completed';
    SELECT COUNT(*) INTO v_failed FROM public.raw_event_staging WHERE status = 'failed';

    -- Get rough average processing time (last 100 completed items)
    -- This is approximate as we don't store explict start time, but we update updated_at on completion
    -- A better metric would be processing duration if logged.
    
    RETURN jsonb_build_object(
        'pending', v_pending,
        'processing', v_processing,
        'completed', v_completed,
        'failed', v_failed,
        'total', v_pending + v_processing + v_completed + v_failed
    );
END;
$$;

COMMENT ON FUNCTION public.get_queue_metrics IS 'Returns current status counts of the Refinery queue.';
