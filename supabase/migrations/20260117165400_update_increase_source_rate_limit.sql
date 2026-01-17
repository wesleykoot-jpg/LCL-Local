-- Migration: Update increase_source_rate_limit to accept and store rate-limit headers
-- Purpose: Extend RPC to capture retry-after, remaining, and reset timestamp from API responses
-- Part of: Issue #surface-api-rate-limit-state

-- Drop the old function signature to create the new one with additional parameters
DROP FUNCTION IF EXISTS increase_source_rate_limit(UUID, INTEGER);

-- Recreate function with extended parameters for rate-limit header values
CREATE OR REPLACE FUNCTION increase_source_rate_limit(
  p_source_id UUID,
  p_status_code INTEGER,
  p_retry_after_seconds INTEGER DEFAULT NULL,
  p_remaining INTEGER DEFAULT NULL,
  p_reset_ts TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_current_rate_limit INTEGER;
  v_new_rate_limit INTEGER;
  v_base_rate_limit INTEGER;
BEGIN
  -- Only process 403 or 429 status codes
  IF p_status_code NOT IN (403, 429) THEN
    RETURN;
  END IF;

  -- Get current rate limits
  SELECT 
    COALESCE((config->>'rate_limit_ms')::INTEGER, 200),
    COALESCE(dynamic_rate_limit_ms, (config->>'rate_limit_ms')::INTEGER, 200)
  INTO v_base_rate_limit, v_current_rate_limit
  FROM scraper_sources
  WHERE id = p_source_id;

  -- Double the rate limit (exponential backoff)
  v_new_rate_limit := LEAST(v_current_rate_limit * 2, 30000); -- Cap at 30 seconds

  -- Update source with new rate limit and captured header values
  UPDATE scraper_sources
  SET 
    dynamic_rate_limit_ms = v_new_rate_limit,
    rate_limit_increased_at = now(),
    rate_limit_increase_count = COALESCE(rate_limit_increase_count, 0) + 1,
    last_403_429_at = now(),
    -- Store rate-limit state from headers (only update if provided)
    last_rate_limit_retry_after_seconds = COALESCE(p_retry_after_seconds, last_rate_limit_retry_after_seconds),
    last_rate_limit_remaining = COALESCE(p_remaining, last_rate_limit_remaining),
    last_rate_limit_reset_ts = COALESCE(p_reset_ts, last_rate_limit_reset_ts),
    updated_at = now()
  WHERE id = p_source_id;

  RAISE NOTICE 'Rate limit increased for source % from % to % ms (retry_after: %s, remaining: %, reset: %)', 
    p_source_id, v_current_rate_limit, v_new_rate_limit, 
    p_retry_after_seconds, p_remaining, p_reset_ts;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increase_source_rate_limit(UUID, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ) IS 
  'Automatically doubles the rate limit for a source after receiving a 403 or 429 response. Also captures rate-limit headers (retry-after, remaining, reset timestamp) for observability. Rate limit increase expires after 24 hours.';
