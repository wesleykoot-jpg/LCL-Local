-- Add exponential backoff for failed sources instead of permanent auto-disable
-- This allows sources to be retried after a cooling-off period

-- Add columns for exponential backoff tracking
ALTER TABLE scraper_sources
ADD COLUMN IF NOT EXISTS backoff_until timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS backoff_level integer DEFAULT 0;

-- Comment on new columns
COMMENT ON COLUMN scraper_sources.backoff_until IS 
'Timestamp until which this source should not be scraped due to repeated failures. NULL means no backoff active.';

COMMENT ON COLUMN scraper_sources.backoff_level IS 
'Current exponential backoff level (0-5). Determines backoff duration: 2^level hours. Reset on successful scrape.';

-- Update scrape-coordinator query to exclude sources in backoff period
-- Create a view that includes backoff logic
CREATE OR REPLACE VIEW scraper_sources_available AS
SELECT 
  id, 
  name, 
  url,
  enabled,
  auto_disabled,
  consecutive_failures,
  backoff_level,
  backoff_until
FROM scraper_sources
WHERE 
  enabled = true 
  AND auto_disabled = false
  AND (backoff_until IS NULL OR backoff_until < NOW());

COMMENT ON VIEW scraper_sources_available IS 
'View of scraper sources that are currently available for scraping. Excludes disabled sources and sources in exponential backoff period.';

-- Grant access to the view
GRANT SELECT ON scraper_sources_available TO authenticated, anon, service_role;

-- Function to calculate and apply exponential backoff on failure
CREATE OR REPLACE FUNCTION apply_exponential_backoff(
  p_source_id uuid,
  p_success boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source RECORD;
  v_backoff_hours integer;
  v_new_backoff_until timestamptz;
  v_result jsonb;
BEGIN
  -- Get current source state
  SELECT 
    id, 
    name,
    consecutive_failures,
    backoff_level,
    backoff_until
  INTO v_source
  FROM scraper_sources
  WHERE id = p_source_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'source_not_found');
  END IF;

  -- If scrape was successful, reset backoff
  IF p_success THEN
    UPDATE scraper_sources
    SET 
      consecutive_failures = 0,
      backoff_level = 0,
      backoff_until = NULL,
      auto_disabled = false  -- Re-enable if it was auto-disabled
    WHERE id = p_source_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'backoff_reset',
      'source_name', v_source.name
    );
  END IF;

  -- Scrape failed, increment failure counter
  UPDATE scraper_sources
  SET consecutive_failures = consecutive_failures + 1
  WHERE id = p_source_id;

  -- Check if we need to apply backoff (3+ consecutive failures)
  IF v_source.consecutive_failures + 1 >= 3 THEN
    -- Calculate exponential backoff: 2^level hours (1h, 2h, 4h, 8h, 16h, max 32h)
    v_backoff_hours := LEAST(POWER(2, v_source.backoff_level + 1)::integer, 32);
    v_new_backoff_until := NOW() + (v_backoff_hours || ' hours')::interval;
    
    -- Apply backoff and increment level
    UPDATE scraper_sources
    SET 
      backoff_level = LEAST(backoff_level + 1, 5),  -- Cap at level 5 (32h max)
      backoff_until = v_new_backoff_until,
      auto_disabled = false  -- Don't permanently disable, just backoff
    WHERE id = p_source_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'backoff_applied',
      'source_name', v_source.name,
      'consecutive_failures', v_source.consecutive_failures + 1,
      'backoff_level', v_source.backoff_level + 1,
      'backoff_hours', v_backoff_hours,
      'backoff_until', v_new_backoff_until
    );
  END IF;

  -- Failure recorded but below backoff threshold
  RETURN jsonb_build_object(
    'success', true,
    'action', 'failure_recorded',
    'source_name', v_source.name,
    'consecutive_failures', v_source.consecutive_failures + 1,
    'threshold', 3
  );
END;
$$;

COMMENT ON FUNCTION apply_exponential_backoff(uuid, boolean) IS 
'Applies exponential backoff to a source after repeated failures. Backoff duration increases exponentially: 1h, 2h, 4h, 8h, 16h, 32h (max). Reset on successful scrape. Prevents permanent auto-disable by using temporary backoff periods instead.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION apply_exponential_backoff(uuid, boolean) TO service_role, authenticated;

-- Create index for backoff queries
CREATE INDEX IF NOT EXISTS idx_scraper_sources_backoff 
ON scraper_sources (backoff_until) 
WHERE backoff_until IS NOT NULL;

COMMENT ON INDEX idx_scraper_sources_backoff IS 
'Optimizes queries that filter sources by backoff status';
