-- Create RPC function to find events needing geocoding
-- This is needed because PostGIS queries don't work well with Supabase's .or() filter

CREATE OR REPLACE FUNCTION get_events_needing_geocoding(p_limit INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  venue_name TEXT,
  title TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT id, venue_name, title
  FROM events
  WHERE ST_Equals(location::geometry, ST_SetSRID(ST_Point(0, 0), 4326)::geometry)
     OR location IS NULL
  LIMIT p_limit;
$$;

-- Grant execute to service_role and anon
GRANT EXECUTE ON FUNCTION get_events_needing_geocoding TO service_role, anon;

COMMENT ON FUNCTION get_events_needing_geocoding IS 
  'Returns events that need geocoding (have POINT(0,0) or NULL location)';
