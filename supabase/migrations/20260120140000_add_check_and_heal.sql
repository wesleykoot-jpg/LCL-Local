-- Function to handle self-healing fetcher logic
-- Automatically switches fetcher_type when source returns 0 events 3+ times
CREATE OR REPLACE FUNCTION check_and_heal_fetcher(
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
  v_new_fetcher_type text;
  v_healed boolean := false;
  v_result jsonb;
BEGIN
  -- Get current source state
  SELECT 
    id, 
    name,
    fetcher_type::text as fetcher_type,
    consecutive_zero_events
  INTO v_source
  FROM scraper_sources
  WHERE id = p_source_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('healed', false, 'reason', 'source_not_found');
  END IF;

  -- If events were found, reset the counter
  IF p_events_found > 0 THEN
    UPDATE scraper_sources
    SET 
      consecutive_zero_events = 0,
      last_non_zero_scrape = now()
    WHERE id = p_source_id;
    
    RETURN jsonb_build_object('healed', false, 'reason', 'events_found', 'events', p_events_found);
  END IF;

  -- If HTTP status is not 200 OK, don't count as zero-event issue
  IF p_http_status != 200 THEN
    RETURN jsonb_build_object('healed', false, 'reason', 'non_200_status', 'status', p_http_status);
  END IF;

  -- Increment zero events counter
  UPDATE scraper_sources
  SET consecutive_zero_events = consecutive_zero_events + 1
  WHERE id = p_source_id;

  -- Check if we need to heal (3+ consecutive zero-event runs with 200 OK)
  IF v_source.consecutive_zero_events >= 2 THEN -- Will be 3 after this run
    -- Determine new fetcher type based on current type
    v_new_fetcher_type := CASE v_source.fetcher_type
      WHEN 'static' THEN 'puppeteer'
      WHEN 'puppeteer' THEN 'scrapingbee'
      WHEN 'playwright' THEN 'scrapingbee'
      ELSE 'puppeteer'  -- fallback
    END;

    -- Update fetcher type
    UPDATE scraper_sources
    SET 
      fetcher_type = v_new_fetcher_type::fetcher_type_enum,
      consecutive_zero_events = 0  -- Reset counter after healing
    WHERE id = p_source_id;

    v_healed := true;
    
    RETURN jsonb_build_object(
      'healed', true,
      'source_name', v_source.name,
      'old_fetcher', v_source.fetcher_type,
      'new_fetcher', v_new_fetcher_type,
      'consecutive_zero_events', v_source.consecutive_zero_events + 1
    );
  END IF;

  RETURN jsonb_build_object(
    'healed', false,
    'reason', 'below_threshold',
    'consecutive_zero_events', v_source.consecutive_zero_events + 1,
    'threshold', 3
  );
END;
$$;

-- Grant execute permission to authenticated users (and service role)
GRANT EXECUTE ON FUNCTION check_and_heal_fetcher(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_heal_fetcher(uuid, integer, integer) TO service_role;
