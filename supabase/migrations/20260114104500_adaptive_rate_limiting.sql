-- Migration: Adaptive Rate Limiting for Scraper Sources
-- Purpose: Enable dynamic rate limit adjustment based on 403/429 responses
-- Supports automatic throttling to avoid detection and rate limiting

-- Add columns for adaptive rate limiting
ALTER TABLE public.scraper_sources
  ADD COLUMN IF NOT EXISTS dynamic_rate_limit_ms INTEGER,
  ADD COLUMN IF NOT EXISTS rate_limit_increased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rate_limit_increase_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_403_429_at TIMESTAMPTZ;

-- Add index for efficient querying of rate-limited sources
CREATE INDEX IF NOT EXISTS idx_scraper_sources_rate_limited 
  ON scraper_sources(rate_limit_increased_at) 
  WHERE rate_limit_increased_at IS NOT NULL;

-- Function to increase rate limit after 403/429 response
CREATE OR REPLACE FUNCTION increase_source_rate_limit(
  p_source_id UUID,
  p_status_code INTEGER
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

  -- Update source with new rate limit (expires after 24 hours)
  UPDATE scraper_sources
  SET 
    dynamic_rate_limit_ms = v_new_rate_limit,
    rate_limit_increased_at = now(),
    rate_limit_increase_count = COALESCE(rate_limit_increase_count, 0) + 1,
    last_403_429_at = now()
  WHERE id = p_source_id;

  RAISE NOTICE 'Rate limit increased for source % from % to % ms', 
    p_source_id, v_current_rate_limit, v_new_rate_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to reset rate limit after 24 hours
CREATE OR REPLACE FUNCTION reset_expired_rate_limits() RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  -- Reset dynamic rate limits that are older than 24 hours
  WITH reset_sources AS (
    UPDATE scraper_sources
    SET 
      dynamic_rate_limit_ms = NULL,
      rate_limit_increased_at = NULL
    WHERE 
      rate_limit_increased_at IS NOT NULL
      AND rate_limit_increased_at < (now() - INTERVAL '24 hours')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_reset_count FROM reset_sources;

  IF v_reset_count > 0 THEN
    RAISE NOTICE 'Reset rate limits for % sources', v_reset_count;
  END IF;

  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get effective rate limit (dynamic or base)
CREATE OR REPLACE FUNCTION get_effective_rate_limit(p_source_id UUID) 
RETURNS INTEGER AS $$
DECLARE
  v_dynamic_rate INTEGER;
  v_base_rate INTEGER;
  v_increased_at TIMESTAMPTZ;
BEGIN
  SELECT 
    dynamic_rate_limit_ms,
    COALESCE((config->>'rate_limit_ms')::INTEGER, 200),
    rate_limit_increased_at
  INTO v_dynamic_rate, v_base_rate, v_increased_at
  FROM scraper_sources
  WHERE id = p_source_id;

  -- If dynamic rate limit is set and not expired (24 hours), use it
  IF v_dynamic_rate IS NOT NULL 
     AND v_increased_at IS NOT NULL 
     AND v_increased_at > (now() - INTERVAL '24 hours') THEN
    RETURN v_dynamic_rate;
  END IF;

  -- Otherwise use base rate limit
  RETURN v_base_rate;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION increase_source_rate_limit(UUID, INTEGER) IS 
  'Automatically doubles the rate limit for a source after receiving a 403 or 429 response. Rate limit increase expires after 24 hours.';

COMMENT ON FUNCTION reset_expired_rate_limits() IS 
  'Resets dynamic rate limits that are older than 24 hours back to their base values.';

COMMENT ON FUNCTION get_effective_rate_limit(UUID) IS 
  'Returns the effective rate limit for a source, considering dynamic adjustments and expiration.';
