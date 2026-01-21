-- Self-Healing Pipeline: Auto-Recovery Migration
-- Adds timestamp tracking and auto-recovery function for stuck processing rows

-- Add timestamp columns for tracking processing state
ALTER TABLE "raw_event_staging" 
ADD COLUMN IF NOT EXISTS "processing_started_at" timestamptz,
ADD COLUMN IF NOT EXISTS "last_health_check" timestamptz DEFAULT NOW();

-- Create index for efficient stuck row queries
CREATE INDEX IF NOT EXISTS idx_raw_event_staging_stuck_processing 
ON "raw_event_staging" (status, processing_started_at) 
WHERE status = 'processing';

-- Auto-recovery function to reset stale processing rows
CREATE OR REPLACE FUNCTION reset_stale_processing_rows()
RETURNS TABLE(reset_count INTEGER, row_ids TEXT[]) AS $$
DECLARE
  v_reset_count INTEGER;
  v_row_ids TEXT[];
BEGIN
  -- Reset rows stuck in processing for > 10 minutes
  WITH reset_rows AS (
    UPDATE raw_event_staging
    SET 
      status = 'pending',
      processing_started_at = NULL,
      retry_count = COALESCE(retry_count, 0) + 1,
      error_message = 'Auto-recovered from stale processing state',
      updated_at = NOW()
    WHERE 
      status = 'processing'
      AND processing_started_at < NOW() - INTERVAL '10 minutes'
      AND COALESCE(retry_count, 0) < 3
    RETURNING id
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(id::TEXT)
  INTO v_reset_count, v_row_ids
  FROM reset_rows;
  
  -- Log the recovery action
  IF v_reset_count > 0 THEN
    RAISE NOTICE 'Auto-recovery: Reset % stuck processing rows', v_reset_count;
  END IF;
  
  RETURN QUERY SELECT v_reset_count, v_row_ids;
END;
$$ LANGUAGE plpgsql;

-- Health check function for monitoring
CREATE OR REPLACE FUNCTION get_pipeline_health()
RETURNS TABLE(
  pending_count BIGINT,
  processing_count BIGINT,
  stuck_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT,
  avg_processing_seconds NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
    COUNT(*) FILTER (WHERE status = 'processing' AND processing_started_at < NOW() - INTERVAL '10 minutes') as stuck_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status = 'completed'), 2) as avg_processing_seconds
  FROM raw_event_staging
  WHERE created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Update trigger to set processing_started_at when status changes to processing
CREATE OR REPLACE FUNCTION set_processing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'processing' AND OLD.status != 'processing' THEN
    NEW.processing_started_at = NOW();
  ELSIF NEW.status != 'processing' THEN
    NEW.processing_started_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_processing_timestamp ON raw_event_staging;
CREATE TRIGGER trg_set_processing_timestamp
  BEFORE UPDATE ON raw_event_staging
  FOR EACH ROW
  EXECUTE FUNCTION set_processing_timestamp();

COMMENT ON FUNCTION reset_stale_processing_rows() IS 'Auto-recovery function that resets rows stuck in processing for >10 minutes';
COMMENT ON FUNCTION get_pipeline_health() IS 'Returns pipeline health metrics for monitoring';
COMMENT ON COLUMN raw_event_staging.processing_started_at IS 'Timestamp when row entered processing state, used for stale detection';
COMMENT ON COLUMN raw_event_staging.last_health_check IS 'Last time this row was checked by health monitoring';
