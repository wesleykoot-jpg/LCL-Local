-- =====================================================
-- LCL Local Development - Seed Data
-- =====================================================
-- This file seeds the local development database with
-- test data for quick development and testing.
--
-- Run automatically with `supabase db reset` or 
-- manually with `psql -f supabase/seed.sql`
-- =====================================================

-- Enable PostGIS extension for geospatial features
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- SEED DATA FOR LOCAL DEVELOPMENT
-- =====================================================

-- Create sample profile for testing
DO $$
DECLARE
  v_profile_id uuid := '11111111-1111-1111-1111-111111111111';
  v_event1_id uuid := '22222222-2222-2222-2222-222222222222';
  v_event2_id uuid := '33333333-3333-3333-3333-333333333333';
  v_event3_id uuid := '44444444-4444-4444-4444-444444444444';
  v_event4_id uuid := '55555555-5555-5555-5555-555555555555';
BEGIN
  -- Only seed if no data exists
  IF NOT EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN

    -- Insert test profile with a known ID for easier testing
    INSERT INTO profiles (
      id, full_name, location_city, location_country,
      location_coordinates, reliability_score, events_attended,
      events_committed, current_persona, verified_resident
    ) VALUES (
      v_profile_id, 'Dev Tester', 'Amsterdam', 'NL',
      ST_SetSRID(ST_MakePoint(4.9, 52.37), 4326)::geography,
      95, 45, 47, 'family', true
    );

    -- Insert persona stats for both personas
    INSERT INTO persona_stats (profile_id, persona_type, rallies_hosted, newcomers_welcomed, host_rating)
    VALUES
      (v_profile_id, 'family', 5, 12, 4.7),
      (v_profile_id, 'gamer', 8, 6, 4.5);

    -- Insert sample badges
    INSERT INTO persona_badges (profile_id, persona_type, badge_name, badge_level, badge_icon)
    VALUES
      (v_profile_id, 'family', 'Test Badge', 'Dev Level', 'Shield'),
      (v_profile_id, 'family', 'Early Adopter', 'Beta Tester', 'Star'),
      (v_profile_id, 'gamer', 'Speed Runner', 'Fast Dev', 'Trophy');

    -- Insert 4 persistent mock events with dynamic dates
    INSERT INTO events (
      id, title, description, category, event_type, venue_name,
      location, event_date, event_time, status, image_url,
      match_percentage, created_by
    ) VALUES
      (
        v_event1_id, 'Cinema Night - Mock Event', 'A persistent test cinema event that refreshes daily',
        'cinema', 'anchor', 'Test Cinema Amsterdam',
        ST_SetSRID(ST_MakePoint(4.9, 52.37), 4326)::geography,
        (CURRENT_DATE + interval '2 days')::timestamp, '19:00',
        'active', 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1000',
        90, v_profile_id
      ),
      (
        v_event2_id, 'Sports Match - Mock Event', 'A persistent test sports event that refreshes daily',
        'sports', 'anchor', 'Test Stadium Amsterdam',
        ST_SetSRID(ST_MakePoint(4.95, 52.35), 4326)::geography,
        (CURRENT_DATE + interval '4 days')::timestamp, '15:00',
        'active', 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1000',
        85, v_profile_id
      ),
      (
        v_event3_id, 'Gaming Session - Mock Event', 'A persistent test gaming event that refreshes daily',
        'gaming', 'signal', 'Online Gaming Hub',
        ST_SetSRID(ST_MakePoint(4.85, 52.40), 4326)::geography,
        (CURRENT_DATE + interval '1 day')::timestamp, '20:00',
        'active', 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1000',
        80, v_profile_id
      ),
      (
        v_event4_id, 'Food Market - Mock Event', 'A persistent test food market event that refreshes daily',
        'food', 'anchor', 'Test Food Market Amsterdam',
        ST_SetSRID(ST_MakePoint(4.88, 52.38), 4326)::geography,
        (CURRENT_DATE + interval '6 days')::timestamp, '11:00',
        'active', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=1000',
        88, v_profile_id
      );

    -- Insert fork events (sidecars)
    INSERT INTO events (
      title, description, category, event_type, parent_event_id,
      venue_name, location, event_date, event_time, status, created_by
    ) VALUES
      (
        'Pre-Movie Drinks', 'Meet before the cinema showing',
        'cinema', 'fork', v_event1_id, 'Test Cafe Amsterdam',
        ST_SetSRID(ST_MakePoint(4.9, 52.37), 4326)::geography,
        (CURRENT_DATE + interval '2 days')::timestamp, '18:00',
        'active', v_profile_id
      ),
      (
        'Post-Match Celebration', 'Drinks after the sports match',
        'sports', 'fork', v_event2_id, 'Test Bar Amsterdam',
        ST_SetSRID(ST_MakePoint(4.95, 52.35), 4326)::geography,
        (CURRENT_DATE + interval '4 days')::timestamp, '17:00',
        'active', v_profile_id
      );

    -- Note: Do NOT add attendance records - user should join via UI to test the join button

    RAISE NOTICE 'Development seed data created successfully!';
    RAISE NOTICE 'Test Profile ID: %', v_profile_id;
    RAISE NOTICE 'Mock Event IDs: %, %, %, %', v_event1_id, v_event2_id, v_event3_id, v_event4_id;
    RAISE NOTICE 'Events will auto-refresh dates daily to stay current';

  ELSE
    RAISE NOTICE 'Seed data already exists, skipping...';
  END IF;
END $$;

-- =====================================================
-- DEVELOPMENT HELPER FUNCTIONS
-- =====================================================

-- Function to refresh mock event dates (keeps events from going to "past")
CREATE OR REPLACE FUNCTION dev_refresh_mock_event_dates()
RETURNS void AS $$
DECLARE
  v_event1_id uuid := '22222222-2222-2222-2222-222222222222';
  v_event2_id uuid := '33333333-3333-3333-3333-333333333333';
  v_event3_id uuid := '44444444-4444-4444-4444-444444444444';
  v_event4_id uuid := '55555555-5555-5555-5555-555555555555';
BEGIN
  -- Update anchor events with fresh dates
  UPDATE events SET event_date = (CURRENT_DATE + interval '2 days')::timestamp WHERE id = v_event1_id;
  UPDATE events SET event_date = (CURRENT_DATE + interval '4 days')::timestamp WHERE id = v_event2_id;
  UPDATE events SET event_date = (CURRENT_DATE + interval '1 day')::timestamp WHERE id = v_event3_id;
  UPDATE events SET event_date = (CURRENT_DATE + interval '6 days')::timestamp WHERE id = v_event4_id;
  
  -- Update fork events to match their parent events
  UPDATE events SET event_date = (CURRENT_DATE + interval '2 days')::timestamp WHERE parent_event_id = v_event1_id;
  UPDATE events SET event_date = (CURRENT_DATE + interval '4 days')::timestamp WHERE parent_event_id = v_event2_id;
  
  RAISE NOTICE 'Mock event dates refreshed! Events are now in the future.';
END;
$$ LANGUAGE plpgsql;

-- Function to reset all data quickly during testing
CREATE OR REPLACE FUNCTION dev_reset_data()
RETURNS void AS $$
BEGIN
  DELETE FROM event_attendees;
  DELETE FROM events;
  DELETE FROM persona_badges;
  DELETE FROM persona_stats;
  DELETE FROM profiles;
  RAISE NOTICE 'All data has been reset!';
END;
$$ LANGUAGE plpgsql;

-- Function to create a quick test profile
CREATE OR REPLACE FUNCTION dev_create_test_profile(
  p_name text DEFAULT 'Quick Test User'
)
RETURNS uuid AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO profiles (id, full_name, location_city, location_country, reliability_score)
  VALUES (v_id, p_name, 'Test City', 'NL', 100);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a quick test event
CREATE OR REPLACE FUNCTION dev_create_test_event(
  p_title text DEFAULT 'Quick Test Event',
  p_category text DEFAULT 'cinema',
  p_profile_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_creator uuid := COALESCE(p_profile_id, (SELECT id FROM profiles LIMIT 1));
BEGIN
  INSERT INTO events (
    id, title, category, event_type, venue_name, 
    location, event_date, event_time, created_by
  )
  VALUES (
    v_id, p_title, p_category, 'anchor', 'Test Venue',
    ST_SetSRID(ST_MakePoint(4.9, 52.37), 4326)::geography,
    now() + interval '7 days', 'Test Time', v_creator
  );
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION dev_refresh_mock_event_dates IS 'Development helper: Refreshes mock event dates to keep them in the future';
COMMENT ON FUNCTION dev_reset_data IS 'Development helper: Clears all data for fresh testing';
COMMENT ON FUNCTION dev_create_test_profile IS 'Development helper: Creates a test profile quickly';
COMMENT ON FUNCTION dev_create_test_event IS 'Development helper: Creates a test event quickly';

-- =====================================================
-- SEED COMPLETE
-- =====================================================
