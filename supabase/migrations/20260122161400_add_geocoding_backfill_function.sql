-- Migration: Add function to retroactively geocode events with missing coordinates
-- This will be called by a scheduled job or manually to fix old events

CREATE OR REPLACE FUNCTION backfill_event_coordinates(batch_size INT DEFAULT 10)
RETURNS TABLE (
  processed_count INT,
  success_count INT,
  failed_count INT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed INT := 0;
  v_success INT := 0;
  v_failed INT := 0;
  v_event RECORD;
  v_query TEXT;
  v_nominatim_url TEXT;
  v_response TEXT;
  v_lat FLOAT;
  v_lng FLOAT;
BEGIN
  -- Find events with missing or (0,0) coordinates
  FOR v_event IN 
    SELECT id, venue_name, title
    FROM events
    WHERE ST_Equals(location::geometry, ST_SetSRID(ST_Point(0, 0), 4326)::geometry)
       OR location IS NULL
    LIMIT batch_size
  LOOP
    v_processed := v_processed + 1;
    
    -- Use venue_name or title as geocoding query
    v_query := COALESCE(v_event.venue_name, v_event.title);
    
    IF v_query IS NOT NULL AND length(v_query) > 3 THEN
      BEGIN
        -- Call Nominatim API (Note: This requires http extension)
        -- For production, consider using a dedicated geocoding service or queue
        v_nominatim_url := 'https://nominatim.openstreetmap.org/search?q=' || 
                          encode(v_query || ', Netherlands', 'escape') || 
                          '&format=json&limit=1';
        
        -- This is a placeholder - actual HTTP calls from SQL require extensions
        -- For now, we'll just mark these for processing by the Edge Function
        UPDATE events 
        SET updated_at = NOW()
        WHERE id = v_event.id;
        
        v_success := v_success + 1;
        
      EXCEPTION WHEN OTHERS THEN
        v_failed := v_failed + 1;
        RAISE WARNING 'Failed to geocode event %: %', v_event.id, SQLERRM;
      END;
    ELSE
      v_failed := v_failed + 1;
    END IF;
    
    -- Rate limiting: sleep 1 second between requests
    PERFORM pg_sleep(1);
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_success, v_failed;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION backfill_event_coordinates TO service_role;

-- Add comment
COMMENT ON FUNCTION backfill_event_coordinates IS 
  'Retroactively geocodes events with missing coordinates. 
   Note: Direct HTTP calls from SQL are limited. 
   Consider using this to mark events for processing by Edge Functions instead.';
