/*
  # Personalized Feed RPC

  Creates a Postgres function that mirrors the client-side feedAlgorithm.ts scoring logic and
  runs it server-side for scalability.

  Scoring weights:
    - Category Match:   35%
    - Time Relevance:   20%
    - Social Proof:     15%
    - Distance:         20%
    - Compatibility:    10% (match_percentage)

  Inputs:
    - user_lat, user_long: User coordinates (fallback to profile location)
    - user_id: Profile identifier for preferences and reliability
    - limit_count, offset_count: Pagination

  Output:
    - Events ordered by final_score (desc) with the computed score attached.
*/

-- Ensure profiles can store preference categories for server-side scoring
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS preferred_categories text[] DEFAULT '{}'::text[];

-- Ensure reliability_score column is present (used for compatibility fallback display)
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS reliability_score numeric DEFAULT 100 CHECK (reliability_score >= 0 AND reliability_score <= 100);

-- Ensure geospatial index exists for efficient distance filtering
CREATE INDEX IF NOT EXISTS idx_events_location ON public.events USING GIST(location);

-- Drop old version before recreating
DROP FUNCTION IF EXISTS public.get_personalized_feed(double precision, double precision, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_personalized_feed(
  user_lat double precision,
  user_long double precision,
  user_id uuid,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
) RETURNS TABLE (
  event_id uuid,
  title text,
  description text,
  category text,
  event_type text,
  parent_event_id uuid,
  venue_name text,
  location geography,
  event_date timestamptz,
  event_time text,
  status text,
  image_url text,
  match_percentage int,
  attendee_count int,
  host_reliability numeric,
  distance_km numeric,
  final_score numeric
) AS $$
DECLARE
  v_radius_km numeric := 25;
  v_score_cap numeric := 1.5;
  w_category numeric := 0.35;
  w_time numeric := 0.20;
  w_social numeric := 0.15;
  w_compatibility numeric := 0.10;
  w_distance numeric := 0.20;
  social_log_max numeric := 1000;
  social_log_denominator numeric := LOG(10, social_log_max);
  v_user_point geography;
  v_pref_categories text[] := ARRAY[]::text[];
BEGIN
  IF v_radius_km IS NULL OR v_radius_km <= 0 THEN
    v_radius_km := 25;
  END IF;

  -- Prefer explicit coordinates; fallback to stored profile coordinates
  IF user_lat IS NOT NULL AND user_long IS NOT NULL THEN
    v_user_point := ST_SetSRID(ST_MakePoint(user_long, user_lat), 4326)::geography;
  ELSE
    SELECT location_coordinates
    INTO v_user_point
    FROM public.profiles
    WHERE id = user_id
      AND location_coordinates IS NOT NULL
    LIMIT 1;
  END IF;

  -- Load stored category preferences (empty array -> neutral scoring)
  SELECT COALESCE(preferred_categories, ARRAY[]::text[])
  INTO v_pref_categories
  FROM public.profiles
  WHERE id = user_id
  LIMIT 1;

  RETURN QUERY
  WITH attendee_counts AS (
    SELECT event_id, COUNT(*) FILTER (WHERE status = 'going') AS going_count
    FROM public.event_attendees
    GROUP BY event_id
  ),
  base_scored AS (
    SELECT
      e.id AS event_id,
      e.title,
      e.description,
      e.category,
      e.event_type,
      e.parent_event_id,
      e.venue_name,
      e.location,
      e.event_date,
      e.event_time,
      e.status,
      e.image_url,
      e.match_percentage,
      COALESCE(ac.going_count, 0) AS attendee_count,
      COALESCE(host.reliability_score, 50) AS host_reliability,
      CASE
        WHEN array_length(v_pref_categories, 1) IS NULL THEN 0.5
        WHEN e.category = ANY (v_pref_categories) THEN 1.0
        ELSE 0.3
      END AS category_score,
      CASE
        WHEN EXTRACT(EPOCH FROM (e.event_date - now())) / 86400.0 < 0 THEN 0
        WHEN EXTRACT(EPOCH FROM (e.event_date - now())) / 86400.0 < 1 THEN 1.0
        ELSE GREATEST(
          0.1,
          EXP(- (EXTRACT(EPOCH FROM (e.event_date - now())) / 86400.0) / 7.0)
        )
      END AS time_score,
      CASE
        WHEN COALESCE(ac.going_count, 0) <= 0 THEN 0.2
        ELSE LEAST(
          1.0,
          GREATEST(
            0.2,
            LOG(10, COALESCE(ac.going_count, 0) + 1) / NULLIF(social_log_denominator, 0)
          )
        )
      END AS social_score,
      COALESCE(e.match_percentage, 50)::numeric / 100.0 AS compatibility_score,
      CASE
        WHEN v_user_point IS NULL THEN NULL
        ELSE ST_Distance(e.location, v_user_point) / 1000.0
      END AS distance_km
    FROM public.events e
    LEFT JOIN attendee_counts ac ON ac.event_id = e.id
    LEFT JOIN public.profiles host ON host.id = e.created_by
    WHERE v_user_point IS NULL OR ST_DWithin(e.location, v_user_point, v_radius_km * 1000)
  ),
  scored AS (
    SELECT
      bs.*,
      CASE
        WHEN v_user_point IS NULL THEN 0.5
        WHEN bs.distance_km <= 0.1 THEN 1.0
        ELSE GREATEST(
          0.1,
          LEAST(
            1.0,
            1 / (1 + (bs.distance_km / NULLIF(v_radius_km * 0.5, 0)))
          )
        )
      END AS distance_score
    FROM base_scored bs
  )
  SELECT
    s.event_id,
    s.title,
    s.description,
    s.category,
    s.event_type,
    s.parent_event_id,
    s.venue_name,
    s.location,
    s.event_date,
    s.event_time,
    s.status,
    s.image_url,
    s.match_percentage,
    s.attendee_count,
    s.host_reliability,
    s.distance_km,
    LEAST(
      v_score_cap,
      (
        (s.category_score * w_category) +
        (s.time_score * w_time) +
        (s.social_score * w_social) +
        (s.compatibility_score * w_compatibility) +
        (s.distance_score * w_distance)
      ) * (
        CASE
          WHEN EXTRACT(EPOCH FROM (s.event_date - now())) / 3600.0 < 0 THEN 0.1
          WHEN EXTRACT(EPOCH FROM (s.event_date - now())) / 3600.0 <= 6 THEN 1.2
          WHEN EXTRACT(EPOCH FROM (s.event_date - now())) / 3600.0 <= 24 THEN 1.15
          WHEN EXTRACT(EPOCH FROM (s.event_date - now())) / 3600.0 <= 72 THEN 1.1
          ELSE 1.0
        END
        *
        CASE
          WHEN s.attendee_count >= 100 THEN 1.2
          WHEN s.attendee_count >= 50 THEN 1.15
          WHEN s.attendee_count >= 20 THEN 1.1
          WHEN s.attendee_count >= 10 THEN 1.05
          ELSE 1.0
        END
      )
    ) AS final_score
  FROM scored s
  ORDER BY final_score DESC
  LIMIT COALESCE(limit_count, 20)
  OFFSET COALESCE(offset_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_personalized_feed(double precision, double precision, uuid, integer, integer) IS
  'Server-side feed ranking using category, time, social proof, distance, and compatibility weights.';
