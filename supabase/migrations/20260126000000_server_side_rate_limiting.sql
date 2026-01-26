-- Server-side Rate Limiting Infrastructure
-- Creates database tables and RPC functions for rate limiting
-- This cannot be bypassed by clients unlike client-side rate limiting

-- 1. Create rate_limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key TEXT NOT NULL,           -- The key being rate limited (API key, IP, user ID, etc.)
  key_type TEXT NOT NULL,           -- Type of key: 'api_key', 'ip_address', 'user_id', 'function_name'
  request_timestamp BIGINT NOT NULL,  -- Unix timestamp of the request
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT rate_limits_rate_key_check CHECK (
    key_type IN ('api_key', 'ip_address', 'user_id', 'function_name')
  )
);

-- 2. Create indexes for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_timestamp 
  ON public.rate_limits(rate_key, request_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_timestamp 
  ON public.rate_limits(request_timestamp);

-- 3. Create RPC function for atomic rate limit check
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_key_type TEXT DEFAULT 'api_key',
  p_max_requests INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(
  allowed BOOLEAN,
  request_count BIGINT,
  remaining BIGINT,
  reset_at BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now BIGINT := EXTRACT(EPOCH FROM NOW())::BIGINT;
  v_window_start BIGINT := v_now - p_window_seconds;
  v_request_count BIGINT;
  v_remaining BIGINT;
  v_allowed BOOLEAN;
BEGIN
  -- Insert current request
  INSERT INTO rate_limits (rate_key, key_type, request_timestamp)
  VALUES (p_key, p_key_type, v_now)
  ON CONFLICT DO NOTHING;
  
  -- Count requests in the current window
  SELECT COUNT(*) INTO v_request_count
  FROM rate_limits
  WHERE rate_key = p_key
    AND key_type = p_key_type
    AND request_timestamp >= v_window_start;
  
  -- Calculate remaining and allowed status
  v_remaining := GREATEST(0, p_max_requests - v_request_count);
  v_allowed := v_request_count < p_max_requests;
  
  -- Clean up old records (older than window)
  DELETE FROM rate_limits
  WHERE request_timestamp < v_window_start;
  
  -- Return result
  RETURN QUERY SELECT
    v_allowed AS allowed,
    v_request_count AS request_count,
    v_remaining AS remaining,
    v_now + p_window_seconds AS reset_at;
END;
$$;

-- 4. Create RPC function to ensure rate_limits table exists
CREATE OR REPLACE FUNCTION public.ensure_rate_limits_table()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Table is created by the migration, this is a no-op
  -- Kept for backward compatibility with fallback implementation
  RETURN;
END;
$$;

-- 5. Create RPC function to increment source errors (for coordinator)
CREATE OR REPLACE FUNCTION public.increment_source_errors(p_source_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE scraper_sources
  SET consecutive_errors = consecutive_errors + 1
  WHERE id = ANY(p_source_ids);
END;
$$;

-- 6. Create RPC function to reset source errors (for successful runs)
CREATE OR REPLACE FUNCTION public.reset_source_errors(p_source_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE scraper_sources
  SET consecutive_errors = 0
  WHERE id = ANY(p_source_ids);
END;
$$;

-- 7. Create view for rate limit monitoring
CREATE OR REPLACE VIEW public.rate_limit_stats AS
SELECT
  rate_key,
  key_type,
  COUNT(*) AS total_requests,
  MAX(request_timestamp) AS last_request_at,
  MIN(request_timestamp) AS first_request_at,
  EXTRACT(EPOCH FROM NOW())::BIGINT - MAX(request_timestamp) AS seconds_since_last_request
FROM rate_limits
WHERE request_timestamp >= EXTRACT(EPOCH FROM NOW()::BIGINT - 3600  -- Last hour
GROUP BY rate_key, key_type;

-- 8. Add comments
COMMENT ON TABLE public.rate_limits IS 'Stores request timestamps for server-side rate limiting. Cannot be bypassed by clients.';
COMMENT ON COLUMN public.rate_limits.rate_key IS 'The key being rate limited (API key, IP address, user ID, etc.)';
COMMENT ON COLUMN public.rate_limits.key_type IS 'Type of key: api_key, ip_address, user_id, function_name';
COMMENT ON COLUMN public.rate_limits.request_timestamp IS 'Unix timestamp of the request';
COMMENT ON FUNCTION public.check_rate_limit IS 'Atomically checks rate limits and returns current status. Uses sliding window algorithm.';
COMMENT ON FUNCTION public.increment_source_errors IS 'Increments consecutive_errors counter for given sources';
COMMENT ON FUNCTION public.reset_source_errors IS 'Resets consecutive_errors counter for given sources';
COMMENT ON VIEW public.rate_limit_stats IS 'Provides rate limit statistics for monitoring';

-- 9. Enable RLS and policies
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage rate limits
CREATE POLICY "Service role full access to rate_limits"
  ON public.rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow read access for monitoring (optional, adjust as needed)
CREATE POLICY "Read access to rate_limit_stats"
  ON public.rate_limit_stats
  FOR SELECT
  TO service_role
  USING (true);

-- 10. Grant permissions
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_rate_limits_table TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_source_errors TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_source_errors TO service_role;
GRANT SELECT ON public.rate_limit_stats TO service_role;

-- 11. Create cleanup job (optional - run via cron)
-- This would typically be run by a scheduled job
-- DELETE FROM rate_limits WHERE request_timestamp < EXTRACT(EPOCH FROM NOW())::BIGINT - 86400; -- Delete records older than 24 hours
