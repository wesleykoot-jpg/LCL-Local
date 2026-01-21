-- Migration: Mission Mode Query Function
-- Purpose: Create RPC function for "right now" immediate intent queries
-- Author: AI Assistant
-- Date: 2026-01-21

-- ============================================================================
-- Mission Mode RPC Function: get_mission_mode_events
-- Returns events filtered by intent (lunch, coffee, drinks) within walking distance
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_mission_mode_events(
  p_intent TEXT,
  p_user_lat DOUBLE PRECISION,
  p_user_long DOUBLE PRECISION,
  p_max_distance_km DOUBLE PRECISION DEFAULT 1.0,
  p_limit INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_point geography;
  result JSON;
  category_filter TEXT[];
  now_timestamp TIMESTAMPTZ := NOW();
  today_date DATE := CURRENT_DATE;
  current_hour INT := EXTRACT(HOUR FROM now_timestamp);
BEGIN
  -- Validate user location is provided
  IF p_user_lat IS NULL OR p_user_long IS NULL THEN
    RAISE EXCEPTION 'User location is required for Mission Mode';
  END IF;

  -- Create geography point from user coordinates
  user_point := ST_SetSRID(ST_MakePoint(p_user_long, p_user_lat), 4326)::geography;

  -- ============================================================================
  -- Map intent to category filters
  -- ============================================================================
  CASE p_intent
    WHEN 'lunch' THEN
      category_filter := ARRAY['dining', 'food'];
    WHEN 'coffee' THEN
      category_filter := ARRAY['cafe', 'food'];
    WHEN 'drinks' THEN
      category_filter := ARRAY['nightlife', 'bar', 'dining'];
    WHEN 'explore' THEN
      category_filter := ARRAY['culture', 'art', 'music', 'entertainment'];
    ELSE
      RAISE EXCEPTION 'Invalid intent: %. Must be one of: lunch, coffee, drinks, explore', p_intent;
  END CASE;

  -- ============================================================================
  -- Query events matching intent criteria
  -- Filters:
  -- 1. Category matches intent
  -- 2. Within max walking distance
  -- 3. Time-relevant (is_open_now logic)
  -- 4. Sorted by distance ascending (closest first)
  -- ============================================================================
  SELECT json_build_object(
    'intent', p_intent,
    'events', json_agg(
      json_build_object(
        'id', e.id,
        'title', e.title,
        'description', e.description,
        'category', e.category,
        'event_type', e.event_type,
        'venue_name', e.venue_name,
        'event_date', e.event_date,
        'event_time', e.event_time,
        'image_url', e.image_url,
        'location', json_build_object(
          'lat', ST_Y(e.location::geometry),
          'lng', ST_X(e.location::geometry)
        ),
        'attendee_count', attendee_count,
        'distance_km', distance_km,
        'walking_time_minutes', ROUND(distance_km * 12)::INT -- 12 min per km
      )
      ORDER BY distance_km ASC
    )
  ) INTO result
  FROM (
    SELECT 
      e.*,
      ST_Distance(e.location, user_point) / 1000.0 as distance_km,
      COALESCE(
        (SELECT COUNT(*) FROM public.event_attendees ea WHERE ea.event_id = e.id AND ea.status = 'going'),
        0
      ) as attendee_count
    FROM public.events e
    WHERE 
      -- Category filter
      e.category = ANY(category_filter)
      -- Distance filter
      AND ST_DWithin(e.location, user_point, p_max_distance_km * 1000)
      -- Time relevance filter
      AND (
        -- Event is today or in the future
        e.event_date >= today_date
        -- For lunch: between 11 AM - 3 PM
        AND (
          p_intent != 'lunch' 
          OR (current_hour >= 11 AND current_hour < 15)
        )
        -- For coffee: between 7 AM - 6 PM
        AND (
          p_intent != 'coffee'
          OR (current_hour >= 7 AND current_hour < 18)
        )
        -- For drinks: after 5 PM
        AND (
          p_intent != 'drinks'
          OR current_hour >= 17
        )
      )
    ORDER BY distance_km ASC
    LIMIT p_limit
  ) e;

  -- Return empty array if no results
  IF result IS NULL THEN
    result := json_build_object(
      'intent', p_intent,
      'events', '[]'::json
    );
  END IF;

  RETURN result;
END;
$$;

-- ============================================================================
-- Add helpful comments
-- ============================================================================
COMMENT ON FUNCTION public.get_mission_mode_events IS 
  'Returns events for immediate intent queries (lunch, coffee, drinks, explore). Filters by category, distance (<1km), and time relevance. Sorted by walking distance.';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_mission_mode_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_rails TO authenticated;
