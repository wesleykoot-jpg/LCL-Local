-- =====================================================
-- Recipe-Driven Scraper Architecture Migration
-- Transforms scraper from "brute-force reader" to "intelligent architect"
-- 
-- Strategy: "Scout, Execute, Self-Heal"
-- - Scout: AI analyzes HTML once, generates extraction recipe
-- - Executor: Cheerio uses recipe for cheap, deterministic extraction
-- - Self-Healer: Auto re-scouts when extraction fails
-- =====================================================

-- 1. Add columns for Recipe-Driven extraction
ALTER TABLE scraper_sources 
ADD COLUMN IF NOT EXISTS extraction_recipe jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS city_population_tier int DEFAULT 3,
ADD COLUMN IF NOT EXISTS scout_status text DEFAULT 'pending_scout';

-- Add check constraint for valid scout status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'scraper_sources_scout_status_check'
  ) THEN
    ALTER TABLE scraper_sources 
    ADD CONSTRAINT scraper_sources_scout_status_check 
    CHECK (scout_status IN ('pending_scout', 'active', 'needs_re_scout', 'scouting'));
  END IF;
END $$;

-- 2. Create index for the Scout Worker to find pending jobs
CREATE INDEX IF NOT EXISTS idx_scraper_sources_scout_status 
ON scraper_sources(scout_status) 
WHERE scout_status = 'pending_scout' OR scout_status = 'needs_re_scout';

-- 3. Create helper function to trigger re-scouting
CREATE OR REPLACE FUNCTION trigger_re_scout(p_source_id uuid) 
RETURNS void AS $$
BEGIN
  UPDATE scraper_sources 
  SET 
    scout_status = 'needs_re_scout', 
    consecutive_zero_events = 0,
    updated_at = now()
  WHERE id = p_source_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Create function to activate a source after scouting
CREATE OR REPLACE FUNCTION activate_scout(
  p_source_id uuid,
  p_recipe jsonb
) 
RETURNS void AS $$
BEGIN
  UPDATE scraper_sources 
  SET 
    extraction_recipe = p_recipe,
    scout_status = 'active',
    consecutive_zero_events = 0,
    updated_at = now()
  WHERE id = p_source_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create function to claim sources for scouting (prevents race conditions)
CREATE OR REPLACE FUNCTION claim_sources_for_scouting(p_limit int DEFAULT 5)
RETURNS SETOF scraper_sources AS $$
DECLARE
  claimed_sources scraper_sources[];
BEGIN
  -- Atomically claim sources by updating their status
  WITH to_claim AS (
    SELECT id 
    FROM scraper_sources 
    WHERE scout_status IN ('pending_scout', 'needs_re_scout')
      AND enabled = true
    ORDER BY 
      CASE scout_status 
        WHEN 'needs_re_scout' THEN 1  -- Priority to re-scout
        WHEN 'pending_scout' THEN 2
      END,
      created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE scraper_sources s
  SET 
    scout_status = 'scouting',
    updated_at = now()
  FROM to_claim
  WHERE s.id = to_claim.id
  RETURNING s.* INTO claimed_sources;

  RETURN QUERY
  SELECT * FROM scraper_sources 
  WHERE scout_status = 'scouting'
    AND updated_at > now() - interval '5 minutes'
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create enhanced self-healing function that integrates with scout
CREATE OR REPLACE FUNCTION check_and_trigger_re_scout(
  p_source_id uuid,
  p_events_found integer,
  p_http_status integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source RECORD;
  v_result jsonb;
BEGIN
  -- Get current source state
  SELECT 
    id, 
    name,
    scout_status,
    consecutive_zero_events
  INTO v_source
  FROM scraper_sources
  WHERE id = p_source_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'none', 'reason', 'source_not_found');
  END IF;

  -- If events were found, reset counters
  IF p_events_found > 0 THEN
    UPDATE scraper_sources
    SET 
      consecutive_zero_events = 0,
      last_non_zero_scrape = now()
    WHERE id = p_source_id;
    
    RETURN jsonb_build_object(
      'action', 'none', 
      'reason', 'events_found', 
      'events', p_events_found
    );
  END IF;

  -- Don't count non-200 responses as extraction failures
  IF p_http_status != 200 THEN
    RETURN jsonb_build_object(
      'action', 'none', 
      'reason', 'non_200_status', 
      'status', p_http_status
    );
  END IF;

  -- Increment zero events counter
  UPDATE scraper_sources
  SET consecutive_zero_events = consecutive_zero_events + 1
  WHERE id = p_source_id;

  -- Check if we need to trigger re-scouting (3+ consecutive zero-event runs)
  IF v_source.consecutive_zero_events >= 2 THEN -- Will be 3 after this run
    -- Trigger re-scouting instead of just changing fetcher
    PERFORM trigger_re_scout(p_source_id);
    
    RETURN jsonb_build_object(
      'action', 're_scout_triggered',
      'source_name', v_source.name,
      'consecutive_zero_events', v_source.consecutive_zero_events + 1,
      'reason', 'extraction_recipe_may_be_stale'
    );
  END IF;

  RETURN jsonb_build_object(
    'action', 'none',
    'reason', 'below_threshold',
    'consecutive_zero_events', v_source.consecutive_zero_events + 1,
    'threshold', 3
  );
END;
$$;

-- 7. Add comments for documentation
COMMENT ON COLUMN scraper_sources.extraction_recipe IS 
  'JSON recipe generated by Scout AI for deterministic Cheerio extraction. Schema: {mode, requires_render, config: {container, item, mapping}, hints}';

COMMENT ON COLUMN scraper_sources.city_population_tier IS 
  'Population tier: 1 (>100k, major city), 2 (20k-100k, medium), 3 (<20k, small). Affects discovery depth.';

COMMENT ON COLUMN scraper_sources.scout_status IS 
  'Status: pending_scout (new), scouting (in progress), active (recipe ready), needs_re_scout (extraction failing)';

COMMENT ON FUNCTION trigger_re_scout(uuid) IS 
  'Called when extraction fails 3+ times to trigger AI re-analysis of the source HTML structure';

COMMENT ON FUNCTION activate_scout(uuid, jsonb) IS 
  'Called by scout-worker after successfully generating an extraction recipe';

COMMENT ON FUNCTION claim_sources_for_scouting(int) IS 
  'Atomically claim sources for scouting to prevent race conditions between workers';

-- 8. Grant permissions
GRANT EXECUTE ON FUNCTION trigger_re_scout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION activate_scout(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_sources_for_scouting(int) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_trigger_re_scout(uuid, integer, integer) TO authenticated;
