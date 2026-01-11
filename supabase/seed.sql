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

    -- Insert anchor events with known IDs
    INSERT INTO events (
      id, title, description, category, event_type, venue_name,
      location, event_date, event_time, status, image_url,
      match_percentage, created_by
    ) VALUES
      (
        v_event1_id, 'Test Cinema Event', 'A movie screening for testing',
        'cinema', 'anchor', 'Test Cinema',
        ST_SetSRID(ST_MakePoint(4.9, 52.37), 4326)::geography,
        now() + interval '3 days', 'Test Day • 19:00',
        'Available', 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1000',
        90, v_profile_id
      ),
      (
        v_event2_id, 'Test Sports Match', 'Local sports event for dev testing',
        'sports', 'anchor', 'Test Stadium',
        ST_SetSRID(ST_MakePoint(4.95, 52.35), 4326)::geography,
        now() + interval '5 days', 'Test Day • 15:00',
        'Open', NULL, 85, v_profile_id
      ),
      (
        v_event3_id, 'Test Gaming Session', 'Online gaming meetup for testing',
        'gaming', 'signal', 'Online • Test Server',
        ST_SetSRID(ST_MakePoint(4.85, 52.40), 4326)::geography,
        now() + interval '1 day', 'Tomorrow • 20:00',
        'Lobby Open', NULL, 80, v_profile_id
      );

    -- Insert fork events (sidecars)
    INSERT INTO events (
      title, description, category, event_type, parent_event_id,
      venue_name, location, event_date, event_time, status, created_by
    ) VALUES
      (
        'Pre-Movie Drinks', 'Meet before the movie',
        'cinema', 'fork', v_event1_id, 'Test Cafe',
        ST_SetSRID(ST_MakePoint(4.9, 52.37), 4326)::geography,
        now() + interval '3 days', '18:00 Before Movie',
        'Join us!', v_profile_id
      ),
      (
        'Post-Match Celebration', 'Drinks after the game',
        'sports', 'fork', v_event2_id, 'Test Bar',
        ST_SetSRID(ST_MakePoint(4.95, 52.35), 4326)::geography,
        now() + interval '5 days', 'After Game',
        'Everyone welcome', v_profile_id
      );

    -- Add test attendance records
    INSERT INTO event_attendees (event_id, profile_id, status, ticket_number)
    VALUES
      (v_event1_id, v_profile_id, 'going', '#DEV001'),
      (v_event2_id, v_profile_id, 'interested', '#DEV002'),
      (v_event3_id, v_profile_id, 'going', '#DEV003');

    RAISE NOTICE 'Development seed data created successfully!';
    RAISE NOTICE 'Test Profile ID: %', v_profile_id;
    RAISE NOTICE 'Test Event IDs: %, %, %', v_event1_id, v_event2_id, v_event3_id;

  ELSE
    RAISE NOTICE 'Seed data already exists, skipping...';
  END IF;
END $$;

-- =====================================================
-- DEVELOPMENT HELPER FUNCTIONS
-- =====================================================

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

COMMENT ON FUNCTION dev_reset_data IS 'Development helper: Clears all data for fresh testing';
COMMENT ON FUNCTION dev_create_test_profile IS 'Development helper: Creates a test profile quickly';
COMMENT ON FUNCTION dev_create_test_event IS 'Development helper: Creates a test event quickly';

-- =====================================================
-- SEED COMPLETE
-- =====================================================
