-- Migration: Hybrid Discovery Rails System
-- Purpose: Create RPC function to return structured discovery layout with multiple rail types
-- Author: AI Assistant
-- Date: 2026-01-21

-- ============================================================================
-- Main RPC Function: get_discovery_rails
-- Returns a JSON structure with traditional, AI-driven, and social rails
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_discovery_rails(
  p_user_id UUID,
  p_user_lat DOUBLE PRECISION,
  p_user_long DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 25,
  p_limit_per_rail INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_point geography;
  result JSON;
  now_timestamp TIMESTAMPTZ := NOW();
  today_date DATE := CURRENT_DATE;
  
  -- Rail data holders
  happening_now_events JSON;
  trending_events JSON;
  recent_joins_events JSON;
  social_pulse_events JSON;
  contextual_vibe_events JSON;
BEGIN
  -- Create geography point from user coordinates
  IF p_user_lat IS NOT NULL AND p_user_long IS NOT NULL THEN
    user_point := ST_SetSRID(ST_MakePoint(p_user_long, p_user_lat), 4326)::geography;
  END IF;

  -- ============================================================================
  -- RAIL 1: "What's Happening Now" (Traditional - Geospatial + Temporal)
  -- Events happening within next 6 hours, sorted by distance
  -- ============================================================================
  SELECT json_agg(
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
      'attendee_count', COALESCE(
        (SELECT COUNT(*) FROM public.event_attendees ea WHERE ea.event_id = e.id AND ea.status = 'going'),
        0
      ),
      'distance_km', CASE
        WHEN user_point IS NULL THEN NULL
        ELSE ST_Distance(e.location, user_point) / 1000.0
      END
    )
  ) INTO happening_now_events
  FROM public.events e
  WHERE 
    e.event_date >= now_timestamp
    AND e.event_date <= now_timestamp + INTERVAL '6 hours'
    AND (user_point IS NULL OR ST_DWithin(e.location, user_point, p_radius_km * 1000))
  ORDER BY 
    CASE WHEN user_point IS NULL THEN 0 ELSE ST_Distance(e.location, user_point) END ASC
  LIMIT p_limit_per_rail;

  -- ============================================================================
  -- RAIL 2: "Trending in [City]" (Traditional - Social Proof)
  -- Events with highest attendee counts, within radius
  -- ============================================================================
  SELECT json_agg(
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
      'attendee_count', attendee_count,
      'distance_km', CASE
        WHEN user_point IS NULL THEN NULL
        ELSE ST_Distance(e.location, user_point) / 1000.0
      END
    )
  ) INTO trending_events
  FROM (
    SELECT 
      e.*,
      COALESCE(
        (SELECT COUNT(*) FROM public.event_attendees ea WHERE ea.event_id = e.id AND ea.status = 'going'),
        0
      ) as attendee_count
    FROM public.events e
    WHERE 
      e.event_date >= today_date
      AND (user_point IS NULL OR ST_DWithin(e.location, user_point, p_radius_km * 1000))
    ORDER BY attendee_count DESC
    LIMIT p_limit_per_rail
  ) e;

  -- ============================================================================
  -- RAIL 3: "Based on your recent joins" (AI - Semantic Similarity)
  -- Find events similar to user's last 3 joined events using embeddings
  -- Only if embeddings exist, otherwise return empty
  -- ============================================================================
  WITH user_recent_events AS (
    SELECT e.embedding, e.id as source_event_id
    FROM public.event_attendees ea
    INNER JOIN public.events e ON e.id = ea.event_id
    WHERE 
      ea.profile_id = p_user_id
      AND ea.status = 'going'
      AND e.embedding IS NOT NULL
    ORDER BY ea.created_at DESC
    LIMIT 3
  ),
  similar_events AS (
    SELECT DISTINCT ON (e.id)
      e.id,
      e.title,
      e.description,
      e.category,
      e.event_type,
      e.venue_name,
      e.event_date,
      e.event_time,
      e.image_url,
      COALESCE(
        (SELECT COUNT(*) FROM public.event_attendees ea WHERE ea.event_id = e.id AND ea.status = 'going'),
        0
      ) as attendee_count,
      CASE
        WHEN user_point IS NULL THEN NULL
        ELSE ST_Distance(e.location, user_point) / 1000.0
      END as distance_km,
      MAX(1 - (e.embedding <=> ure.embedding)) as similarity
    FROM public.events e
    CROSS JOIN user_recent_events ure
    WHERE 
      e.id != ure.source_event_id
      AND e.embedding IS NOT NULL
      AND e.event_date >= today_date
      AND (user_point IS NULL OR ST_DWithin(e.location, user_point, p_radius_km * 1000))
      AND 1 - (e.embedding <=> ure.embedding) > 0.7  -- Similarity threshold
    GROUP BY e.id, e.title, e.description, e.category, e.event_type, e.venue_name, 
             e.event_date, e.event_time, e.image_url, e.location, user_point
    ORDER BY e.id, similarity DESC
  )
  SELECT json_agg(
    json_build_object(
      'id', id,
      'title', title,
      'description', description,
      'category', category,
      'event_type', event_type,
      'venue_name', venue_name,
      'event_date', event_date,
      'event_time', event_time,
      'image_url', image_url,
      'attendee_count', attendee_count,
      'distance_km', distance_km,
      'similarity', similarity
    )
  ) INTO recent_joins_events
  FROM (
    SELECT * FROM similar_events
    ORDER BY similarity DESC
    LIMIT p_limit_per_rail
  ) se;

  -- ============================================================================
  -- RAIL 4: "The Social Pulse" (AI - Social Graph)
  -- Events that user's friends are attending
  -- ============================================================================
  WITH friend_events AS (
    SELECT DISTINCT
      e.id,
      e.title,
      e.description,
      e.category,
      e.event_type,
      e.venue_name,
      e.event_date,
      e.event_time,
      e.image_url,
      COALESCE(
        (SELECT COUNT(*) FROM public.event_attendees ea WHERE ea.event_id = e.id AND ea.status = 'going'),
        0
      ) as attendee_count,
      CASE
        WHEN user_point IS NULL THEN NULL
        ELSE ST_Distance(e.location, user_point) / 1000.0
      END as distance_km,
      COUNT(DISTINCT ur.following_id) as friend_count
    FROM public.user_relationships ur
    INNER JOIN public.event_attendees ea ON ea.profile_id = ur.following_id
    INNER JOIN public.events e ON e.id = ea.event_id
    WHERE 
      ur.follower_id = p_user_id
      AND ur.status = 'accepted'
      AND ea.status = 'going'
      AND e.event_date >= today_date
      AND (user_point IS NULL OR ST_DWithin(e.location, user_point, p_radius_km * 1000))
    GROUP BY e.id, e.title, e.description, e.category, e.event_type, e.venue_name,
             e.event_date, e.event_time, e.image_url, e.location, user_point
    ORDER BY friend_count DESC, e.event_date ASC
    LIMIT p_limit_per_rail
  )
  SELECT json_agg(
    json_build_object(
      'id', id,
      'title', title,
      'description', description,
      'category', category,
      'event_type', event_type,
      'venue_name', venue_name,
      'event_date', event_date,
      'event_time', event_time,
      'image_url', image_url,
      'attendee_count', attendee_count,
      'distance_km', distance_km,
      'friend_count', friend_count
    )
  ) INTO social_pulse_events
  FROM friend_events;

  -- ============================================================================
  -- RAIL 5: "Contextual Vibe" (AI - Time-based)
  -- Different vibes based on time of day
  -- Morning (6-12): "Morning Energy", Afternoon (12-18): "Afternoon Escapes"
  -- Evening (18-23): "Evening Vibes", Late Night (23-6): "Late Night Adventures"
  -- ============================================================================
  DECLARE
    current_hour INT := EXTRACT(HOUR FROM now_timestamp);
    vibe_category TEXT;
  BEGIN
    -- Determine vibe based on time
    IF current_hour >= 6 AND current_hour < 12 THEN
      vibe_category := 'wellness,sports,food'; -- Morning activities
    ELSIF current_hour >= 12 AND current_hour < 18 THEN
      vibe_category := 'culture,art,education'; -- Afternoon activities
    ELSIF current_hour >= 18 AND current_hour < 23 THEN
      vibe_category := 'music,nightlife,dining'; -- Evening activities
    ELSE
      vibe_category := 'nightlife,music'; -- Late night
    END IF;

    SELECT json_agg(
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
        'attendee_count', COALESCE(
          (SELECT COUNT(*) FROM public.event_attendees ea WHERE ea.event_id = e.id AND ea.status = 'going'),
          0
        ),
        'distance_km', CASE
          WHEN user_point IS NULL THEN NULL
          ELSE ST_Distance(e.location, user_point) / 1000.0
        END
      )
    ) INTO contextual_vibe_events
    FROM public.events e
    WHERE 
      e.event_date >= today_date
      AND e.category = ANY(string_to_array(vibe_category, ','))
      AND (user_point IS NULL OR ST_DWithin(e.location, user_point, p_radius_km * 1000))
    ORDER BY e.event_date ASC
    LIMIT p_limit_per_rail;
  END;

  -- ============================================================================
  -- Build final JSON response with all rails
  -- ============================================================================
  result := json_build_object(
    'sections', json_build_array(
      -- Rail 1: What's Happening Now
      json_build_object(
        'type', 'traditional',
        'title', 'What''s Happening Now',
        'description', 'Events starting within the next 6 hours',
        'layout', 'carousel',
        'items', COALESCE(happening_now_events, '[]'::json)
      ),
      -- Rail 2: Trending
      json_build_object(
        'type', 'traditional',
        'title', 'Trending in Your Area',
        'description', 'Most popular events near you',
        'layout', 'carousel',
        'items', COALESCE(trending_events, '[]'::json)
      ),
      -- Rail 3: Based on Recent Joins (only if has data)
      CASE 
        WHEN recent_joins_events IS NOT NULL THEN
          json_build_object(
            'type', 'generative',
            'title', 'Based on Your Recent Joins',
            'description', 'Events similar to what you''ve enjoyed',
            'layout', 'carousel',
            'items', recent_joins_events
          )
        ELSE NULL
      END,
      -- Rail 4: Social Pulse (only if has data)
      CASE
        WHEN social_pulse_events IS NOT NULL THEN
          json_build_object(
            'type', 'generative',
            'title', 'The Social Pulse',
            'description', 'Events your friends are attending',
            'layout', 'carousel',
            'items', social_pulse_events
          )
        ELSE NULL
      END,
      -- Rail 5: Contextual Vibe (only if has data)
      CASE
        WHEN contextual_vibe_events IS NOT NULL THEN
          json_build_object(
            'type', 'generative',
            'title', CASE
              WHEN current_hour >= 6 AND current_hour < 12 THEN 'Morning Energy'
              WHEN current_hour >= 12 AND current_hour < 18 THEN 'Afternoon Escapes'
              WHEN current_hour >= 18 AND current_hour < 23 THEN 'Evening Vibes'
              ELSE 'Late Night Adventures'
            END,
            'description', 'Perfect for this time of day',
            'layout', 'carousel',
            'items', contextual_vibe_events
          )
        ELSE NULL
      END
    )
  );

  -- Filter out NULL sections
  result := json_build_object(
    'sections', (
      SELECT json_agg(section)
      FROM json_array_elements(result->'sections') section
      WHERE section IS NOT NULL
    )
  );

  RETURN result;
END;
$$;

-- ============================================================================
-- Add helpful comments
-- ============================================================================
COMMENT ON FUNCTION public.get_discovery_rails IS 
  'Returns structured discovery layout with traditional, AI-driven, and social rails. Gracefully degrades if embeddings or social data is missing.';
